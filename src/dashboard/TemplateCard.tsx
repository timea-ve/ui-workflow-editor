import { useMemo } from 'react';
import type { TemplateDef } from '../platform/templates';
import { DocPreview } from './DocPreview';
import { copy } from './copy';

export const PREVIEW_W = 232;
export const PREVIEW_H = 124;

export function TemplateCard({ template, busy, disabled, onUse }: {
  template: TemplateDef;
  busy: boolean;
  disabled: boolean;
  onUse: (id: TemplateDef['id']) => void;
}) {
  // Built once per card; ids are throwaway — the real board gets a fresh build().
  const doc = useMemo(() => template.build(), [template]);
  return (
    <li className="fsd-tcard">
      <button
        type="button"
        className="fsd-tcard__btn"
        onClick={() => onUse(template.id)}
        disabled={disabled}
        aria-busy={busy || undefined}
        aria-label={`${copy.templateAction(template.name)}. ${template.description} ${copy.templateScreens(template.screenCount)}.`}
        data-testid={`template-${template.id}`}
      >
        <span className="fsd-thumb">
          <DocPreview doc={doc} width={PREVIEW_W} height={PREVIEW_H} />
        </span>
        <span className="fsd-tcard__body">
          <span className="fsd-tcard__name">{template.name}</span>
          <span className="fsd-tcard__desc">{template.description}</span>
          <span className="fsd-tcard__meta">{busy ? copy.creating : copy.templateScreens(template.screenCount)}</span>
        </span>
      </button>
    </li>
  );
}
