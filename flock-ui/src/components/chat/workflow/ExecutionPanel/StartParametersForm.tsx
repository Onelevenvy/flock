import {
  Switch,
  Textarea,
  Select,
  NumberInput,
  TextInput,
  Stack,
} from '@mantine/core';

interface StartParametersFormProps {
  customVars: any[];
  formInputs: Record<string, any>;
  setFormInputs: (inputs: Record<string, any>) => void;
}

export function StartParametersForm({
  customVars,
  formInputs,
  setFormInputs,
}: StartParametersFormProps) {
  return (
    <Stack gap="sm" style={{ background: 'var(--flock-bg-surface)', padding: 12, borderRadius: 12, border: '1px solid var(--flock-border-subtle)' }}>
      {customVars.map((v: any) => {
        const label = `${v.label || v.name} (${v.name})`;
        const required = v.required;
        if (v.type === 'boolean') {
          return (
            <Switch
              key={v.name}
              label={label}
              checked={!!formInputs[v.name]}
              onChange={(e) => setFormInputs({ ...formInputs, [v.name]: e.currentTarget.checked })}
              size="xs"
            />
          );
        }
        if (v.type === 'paragraph') {
          return (
            <Textarea
              key={v.name}
              label={label}
              placeholder={v.default_value ?? ''}
              value={formInputs[v.name] ?? ''}
              onChange={(e) => setFormInputs({ ...formInputs, [v.name]: e.target.value })}
              size="xs"
              minRows={2}
              required={required}
            />
          );
        }
        if (v.type === 'select') {
          const selectOptions = (v.options as string[]) ?? [];
          return (
            <Select
              key={v.name}
              label={label}
              placeholder={v.default_value ?? ''}
              data={selectOptions.map((o) => ({ value: o, label: o }))}
              value={formInputs[v.name] ?? ''}
              onChange={(val) => setFormInputs({ ...formInputs, [v.name]: val })}
              size="xs"
              required={required}
              clearable
            />
          );
        }
        if (v.type === 'number') {
          return (
            <NumberInput
              key={v.name}
              label={label}
              placeholder={String(v.default_value ?? '')}
              value={formInputs[v.name]}
              onChange={(val) => setFormInputs({ ...formInputs, [v.name]: val !== '' && val !== undefined ? Number(val) : undefined })}
              size="xs"
              required={required}
            />
          );
        }
        return (
          <TextInput
            key={v.name}
            label={label}
            placeholder={v.default_value ?? ''}
            value={formInputs[v.name] ?? ''}
            onChange={(e) => setFormInputs({ ...formInputs, [v.name]: e.target.value })}
            size="xs"
            required={required}
          />
        );
      })}
    </Stack>
  );
}
