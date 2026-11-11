import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Input } from '../src/components/ui/Input';

describe('Input UI Component', () => {
  it('renders with explicit id when provided', () => {
    const html = renderToString(<Input id="custom-email-id" label="Email" name="email" />);
    expect(html).toContain('id="custom-email-id"');
    expect(html).toContain('for="custom-email-id"');
  });

  it('renders with name as fallback id when id is omitted', () => {
    const html = renderToString(<Input label="Password" name="staff_password" />);
    expect(html).toContain('id="staff_password"');
    expect(html).toContain('for="staff_password"');
  });

  it('generates a deterministic React useId when both id and name are omitted', () => {
    const html1 = renderToString(<Input label="Default Field" />);
    const html2 = renderToString(<Input label="Default Field" />);

    // In SSR, useId generates a deterministic prefix like :r
    expect(html1).toMatch(/id="[:a-zA-Z0-9_-]+"/);
    expect(html1).toContain('for=');

    // Extract id and htmlFor from html1
    const idMatch = html1.match(/id="([^"]+)"/);
    const forMatch = html1.match(/for="([^"]+)"/);

    expect(idMatch).not.toBeNull();
    expect(forMatch).not.toBeNull();
    expect(idMatch![1]).toBe(forMatch![1]);
    expect(html1).toBe(html2);
  });

  it('does not invoke Math.random() for ID generation', () => {
    let mathRandomCalled = false;
    const originalRandom = Math.random;
    Math.random = () => {
      mathRandomCalled = true;
      return 0.123456;
    };

    try {
      renderToString(<Input label="Test Field" />);
      expect(mathRandomCalled).toBe(false);
    } finally {
      Math.random = originalRandom;
    }
  });
});
