# Production Deployment & Hosting Guide (Phase 7 Handover)

**Document Code:** P7-DEPLOY-GUIDE-001  
**Project:** School Admission & Fee Management Portal  
**Target Organization:** ABC English Medium School  
**Vendor:** Intallo  
**Delivery Scope:** Source-Only Delivery Boundary (BRD §13, DEC-09)  
**Verification Date:** 29 October 2026  
**Status:** **Approved Handover Guidance**  

---

## 1. Scope & Responsibility Boundary

In accordance with signed BRD v1.4 Section 6.3, signed SRS v1.4 Section 1.3, and confirmed Decision `DEC-09`:
- **Vendor Responsibility (Intallo):** Delivers verified source code, standalone build artifacts, container configuration files, database migration scripts, and deployment instructions. Intallo does not deploy to a live client server or configure live production DNS/TLS unless separately contracted.
- **Client Responsibility (ABC English Medium School):** Provides and operates server hardware, cloud hosting accounts, domain names, SSL/TLS certificates, reverse proxy load balancers, database instances, and operating system security patches.

---

## 2. Target Production Architecture

```mermaid
flowchart TD
    INTERNET["School Intranet / HTTPS Internet"] -->|Port 443 / TLS 1.3| NGINX["Nginx Reverse Proxy / Load Balancer<br>(SSL Termination, Security Headers)"]
    
    subgraph APP_SERVER["Application Host (Linux Ubuntu 22.04/24.04 LTS)"]
        NGINX -->|HTTP / Reverse Proxy :3000| NODE["Next.js 14 Standalone Server<br>(Node.js 20+ Runtime or Docker Container)"]
    end
    
    subgraph DATA_TIER["Database & Storage Tier (Private Subnet)"]
        NODE -->|Port 5432 (SSL Required)| PG[("PostgreSQL 15+ Database<br>(Dedicated Database User)")]
        NODE -->|HTTPS / S3 API| S3["Object Storage / Supabase Storage<br>(Student Documents & Photos)"]
    end
```

---

## 3. Deployment Option A: Containerized Deployment (Docker)

The application produces a production-ready standalone output bundle (`output: 'standalone'`).

### 3.1 Production Dockerfile (`Dockerfile`)
```dockerfile
# Stage 1: Dependency resolution & build
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build Next.js standalone bundle (telemetry disabled)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 2: Minimal Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build and static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

### 3.2 Docker Compose Production Deployment (`docker-compose.prod.yml`)
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: always
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_SUPABASE_URL=https://school-db.internal:54321
      - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_PUBLISHABLE_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - DATABASE_URL=postgresql://school_app_user:${DB_PASSWORD}@postgres:5432/school_portal
      - ALLOW_REMOTE_DATABASE=true
    depends_on:
      - postgres

  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: school_portal
      POSTGRES_PASSWORD: ${DB_ROOT_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./supabase/migrations:/docker-entrypoint-initdb.d
    ports:
      - "127.0.0.1:5432:5432"

volumes:
  pgdata:
```

---

## 4. Deployment Option B: Bare-Metal Linux VM (Ubuntu LTS + Nginx + PM2)

### Step 1: Install Node.js 20 LTS and PM2
```bash
sudo apt update && sudo apt install -y curl git nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### Step 2: Clone and Build
```bash
sudo mkdir -p /var/www/school-portal
sudo chown -R $USER:$USER /var/www/school-portal
git clone https://github.com/Intallo/School-Admission-Fee-Management-Portal.git /var/www/school-portal
cd /var/www/school-portal
npm ci
cp .env.example .env.production
# Edit .env.production with client's production database credentials
export NEXT_TELEMETRY_DISABLED=1
npm run build
```

### Step 3: Run with PM2 Process Manager
```bash
pm2 start npm --name "school-portal" -- start
pm2 save
pm2 startup
```

### Step 4: Configure Nginx Reverse Proxy with TLS
Create `/etc/nginx/sites-available/school-portal`:
```nginx
server {
    listen 80;
    server_name portal.abcschool.edu.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name portal.abcschool.edu.in;

    ssl_certificate /etc/letsencrypt/live/portal.abcschool.edu.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal.abcschool.edu.in/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Institutional Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Enable site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/school-portal /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. Production Security Verification Checklist

Before opening the live portal to school users, the client system administrator must complete these verifications:
- [ ] TLS certificate is valid and redirects HTTP to HTTPS automatically.
- [ ] Database is accessible only via private network or localhost (port 5432 blocked to public internet).
- [ ] Node.js application connects to PostgreSQL using the restricted role `school_app_user` (US-33 AC2).
- [ ] The default password for `system.admin@school-demo.example` has been changed upon first login.
- [ ] Daily automated backups (`pg_dump`) are running and verified with test restoration.
- [ ] Storage bucket permissions are private with zero public read/write access.
