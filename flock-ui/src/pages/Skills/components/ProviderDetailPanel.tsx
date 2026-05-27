import {
  Box,
  Text,
  Badge,
  Group,
  ActionIcon,
  Stack,
  Accordion,
  PasswordInput,
  Button,
  Divider,
  ScrollArea,
  Alert,
} from '@mantine/core';
import {
  IconX,
  IconEye,
  IconEyeOff,
  IconChevronRight,
  IconInfoCircle,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import type { ToolProvider, Tool } from '../types';
import { getProviderDescription, getProviderName, formatLabel, parseInputSchema, getToolName, getToolDescription, getToolParamDescription } from '../helpers';
import { ToolsIcon } from '../../../components/Common/Icons';
import { useProviderCredentials } from '../hooks/useProviderCredentials';

export function renderTextWithLinks(text: string) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s"'()<>]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (part.match(/^https?:\/\//)) {
      return (
        <Text
          key={index}
          component="span"
          size="xs"
          style={{
            color: 'var(--flock-accent, #228be6)',
            textDecoration: 'underline',
            cursor: 'pointer',
            wordBreak: 'break-all',
          }}
          onClick={(e) => {
            e.stopPropagation();
            invoke('open_external_url', { url: part }).catch(console.error);
          }}
        >
          {part}
        </Text>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function ProviderDetailPanel({
  provider,
  tools,
  onClose,
  onCredentialsSaved,
}: {
  provider: ToolProvider;
  tools: Tool[];
  onClose: () => void;
  onCredentialsSaved: () => void;
}) {
  const { t } = useTranslation();
  const {
    credValues,
    setCredValues,
    saving,
    isSandboxProvider,
    credSchema,
    hasCredentials,
    handleSaveCredentials,
  } = useProviderCredentials(provider, onCredentialsSaved);

  return (
    <Box
      style={{
        width: 380,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        border: '1px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-base)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        minHeight: 0,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Group justify="space-between" p="md" pb="sm">
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClose}>
          <IconX size={16} />
        </ActionIcon>
      </Group>

      <Box px="md" pb="md">
        <Group gap="sm" mb="xs">
          <Box
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              background: 'var(--flock-bg-surface)',
              border: '1px solid var(--flock-border-subtle)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            <ToolsIcon name={provider.icon || provider.id} size={24} />
          </Box>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)' }} truncate>
              {getProviderName(provider)}
            </Text>
            {provider.is_available ? (
              <Group gap={4}>
                <Box style={{ width: 8, height: 8, borderRadius: '50%', background: '#51cf66' }} />
                <Text size="xs" c="dimmed">
                  {t('skills.tools.available')}
                </Text>
              </Group>
            ) : provider.credentials_schema ? (
              <Badge size="xs" variant="light" color="orange">
                {t('skills.tools.needAuth')}
              </Badge>
            ) : (
              <Badge size="xs" variant="light" color="red">
                {t('skills.tools.unavailable')}
              </Badge>
            )}
          </Box>
        </Group>
        <Text size="xs" c="dimmed">{renderTextWithLinks(getProviderDescription(provider))}</Text>
      </Box>

      <Divider />

      {isSandboxProvider && (
        <Box px="md" pt="md" pb="sm">
          <Alert
            icon={<IconInfoCircle size={16} />}
            color="blue"
            variant="light"
            radius="md"
          >
            {t('skills.tools.sandboxConfigHint')}
          </Alert>
        </Box>
      )}

      {hasCredentials && (
        <Box px="md" pt="md">
          <Group gap="xs" mb="sm">
            <IconChevronRight size={14} color="var(--flock-text-dim)" />
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.05em' }}>
              {t('skills.tools.authInfo')}
            </Text>
          </Group>
          <Stack gap="sm">
            {Object.entries(credSchema).map(([key, field]) => (
              <Box
                key={key}
                p="sm"
                style={{
                  borderRadius: 8,
                  background: 'var(--flock-bg-surface)',
                  border: '1px solid var(--flock-border-subtle)',
                }}
              >
                <Group gap={6} mb={6}>
                  <Text size="xs" fw={500} c="var(--flock-text-secondary)">{formatLabel(key)}</Text>
                  {field.description && (
                    <Text size="xs" c="dimmed">
                      — {renderTextWithLinks(field.description)}
                    </Text>
                  )}
                </Group>
                <PasswordInput
                  size="xs"
                  value={credValues[key] || ''}
                  placeholder={formatLabel(key)}
                  onChange={(e) => setCredValues((prev) => ({ ...prev, [key]: e.currentTarget.value }))}
                  visibilityToggleIcon={({ reveal }) => reveal ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                  styles={{ input: { background: 'var(--flock-bg-base)', borderColor: 'var(--flock-border-dim)' } }}
                />
              </Box>
            ))}
          </Stack>
          <Button size="xs" color="blue" fullWidth mt="sm" mb="sm" loading={saving} onClick={handleSaveCredentials}>
            {t('skills.tools.authBtn')}
          </Button>
          <Divider />
        </Box>
      )}

      <Group gap="xs" px="md" pt="sm" pb="sm">
        <IconChevronRight size={14} color="var(--flock-text-dim)" />
        <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.05em' }}>
          {t('skills.tools.availableTools')}
        </Text>
      </Group>

      <ScrollArea style={{ flex: 1, minHeight: 0 }} px="md" pb="md">
        {tools.length > 0 ? (
          <Accordion variant="separated" radius="md" chevronPosition="left">
            {tools.map((tool) => {
              const params = parseInputSchema(tool.input_schema);
              const translatedName = getToolName(tool, provider, t);
              const translatedDesc = getToolDescription(tool, provider, t);
              return (
                <Accordion.Item key={tool.id} value={tool.id}>
                  <Accordion.Control style={{ borderRadius: 8, background: 'var(--flock-bg-surface)' }}>
                    <Text size="sm" fw={500}>{translatedName}</Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      <Text size="xs" c="dimmed">{renderTextWithLinks(translatedDesc)}</Text>
                      {Object.keys(params).length > 0 && (
                        <Box>
                          <Text size="xs" fw={500} mb={4}>
                            {t('skills.tools.params')}
                          </Text>
                          <Stack gap={4}>
                            {Object.entries(params).map(([paramName, param]) => {
                              const translatedParamDesc = getToolParamDescription(paramName, param.description, tool, provider, t);
                              return (
                                <Box key={paramName} p={6} style={{ borderRadius: 6, background: 'var(--flock-bg-surface)' }}>
                                  <Group justify="space-between" mb={2}>
                                    <Text size="xs" fw={500}>{formatLabel(paramName)}</Text>
                                    <Badge size="xs" variant="filled" color="blue">{param.type || 'any'}</Badge>
                                  </Group>
                                  <Text size="xs" c="dimmed" style={{ wordBreak: 'break-word' }}>{renderTextWithLinks(translatedParamDesc)}</Text>
                                </Box>
                              );
                            })}
                          </Stack>
                        </Box>
                      )}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
          </Accordion>
        ) : (
          <Text size="xs" c="dimmed" fs="italic">
            {t('skills.tools.noAvailableTools')}
          </Text>
        )}
      </ScrollArea>
    </Box>
  );
}
