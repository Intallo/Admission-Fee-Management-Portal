import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './Card';
import { Badge } from './Badge';

export interface ModuleScaffoldProps {
  moduleName: string;
  moduleCode: string;
  scheduledPhase: string;
  description: string;
  targetStories: string[];
  keyInvariants: string[];
}

export function ModuleScaffold({
  moduleName,
  moduleCode,
  scheduledPhase,
  description,
  targetStories,
  keyInvariants,
}: ModuleScaffoldProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-school-text">{moduleName}</h1>
            <Badge variant="info">{moduleCode}</Badge>
            <Badge variant="warning">{scheduledPhase}</Badge>
          </div>
          <p className="text-sm text-school-text-muted mt-1">{description}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Module Implementation Status</CardTitle>
              <CardDescription>
                Phase 2 foundation complete: domain contracts, types, and route architecture are established.
              </CardDescription>
            </div>
            <Badge variant="default">Scaffold Only</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-xs text-amber-900 leading-relaxed">
            <strong className="font-semibold block mb-1">Architecture Boundary Notice:</strong>
            Per Phase 2 specification, business transactional workflows for this module are scheduled in{' '}
            <span className="font-semibold">{scheduledPhase}</span>. To maintain architectural integrity and audit fidelity, mock or pseudo-functional forms are not enabled until underlying verified procedures and database role access are activated.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="border border-school-border rounded-md p-4 bg-school-surface-subtle">
              <h4 className="text-xs font-bold uppercase tracking-wider text-school-primary mb-2">
                Targeted SRS User Stories
              </h4>
              <ul className="text-xs space-y-1.5 text-school-text-muted">
                {targetStories.map((story, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-school-primary font-semibold">•</span>
                    <span>{story}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-school-border rounded-md p-4 bg-school-surface-subtle">
              <h4 className="text-xs font-bold uppercase tracking-wider text-school-primary mb-2">
                Approved Phase 1 Invariants
              </h4>
              <ul className="text-xs space-y-1.5 text-school-text-muted">
                {keyInvariants.map((inv, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-school-success font-semibold">✓</span>
                    <span>{inv}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
