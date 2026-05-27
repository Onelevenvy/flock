import { Switch, Slider, Stack, Text, Group, Button, Box, Paper, Divider } from '@mantine/core';
import { IconPaw, IconBubble, IconRefresh } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { usePetStore } from '../../../store/petStore';
import { XiaofCharacter } from '../../Pet/XiaofCharacter';
import type { XiaofMood } from '../../../hooks/useXiaofState';
import { useState } from 'react';

const MOOD_PREVIEWS: { mood: XiaofMood; labelKey: string }[] = [
  { mood: 'idle',     labelKey: 'pet.status.idle' },
  { mood: 'thinking', labelKey: 'pet.status.thinking' },
  { mood: 'working',  labelKey: 'pet.status.working' },
  { mood: 'waiting',  labelKey: 'pet.status.waiting' },
  { mood: 'error',    labelKey: 'pet.status.error' },
  { mood: 'sleeping', labelKey: 'pet.status.sleeping' },
];

export default function PetSettings() {
  const { t } = useTranslation();
  const {
    enabled, setEnabled,
    bubbleEnabled, setBubbleEnabled,
    bubbleDuration, setBubbleDuration,
    resetPosition,
  } = usePetStore();

  const [previewMood, setPreviewMood] = useState<XiaofMood>('idle');

  return (
    <Stack gap={32}>
      {/* ── Preview ─────────────────────────────────── */}
      <Paper
        p="xl"
        radius="xl"
        style={{
          background: 'var(--flock-bg-deepest)',
          border: '1px solid var(--flock-border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <Text size="sm" fw={600} c="dimmed" style={{ letterSpacing: '0.5px' }}>
          {t('pet.settings.previewTitle')}
        </Text>

        {/* Character preview */}
        <Box
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1.5px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: PREVIEW_GLOW[previewMood],
          }}
        >
          <XiaofCharacter mood={previewMood} size={80} />
        </Box>

        {/* Mood selector */}
        <Group gap={8} justify="center" wrap="wrap">
          {MOOD_PREVIEWS.map(({ mood, labelKey }) => (
            <Button
              key={mood}
              size="xs"
              variant={previewMood === mood ? 'filled' : 'subtle'}
              color={previewMood === mood ? 'blue' : 'gray'}
              radius="xl"
              onClick={() => setPreviewMood(mood)}
              style={{ fontSize: 11, padding: '3px 10px', height: 24 }}
            >
              {t(labelKey)}
            </Button>
          ))}
        </Group>
      </Paper>

      {/* ── Enable/Disable ───────────────────────────── */}
      <Stack gap={16}>
        <Group gap={8} mb={4}>
          <IconPaw size={18} style={{ color: 'var(--flock-accent)' }} />
          <Text size="sm" fw={700}>{t('pet.settings.generalTitle')}</Text>
        </Group>

        <Paper p="md" radius="lg" style={{ background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-dim)' }}>
          <Group justify="space-between">
            <Box>
              <Text size="sm" fw={600}>{t('pet.settings.enableLabel')}</Text>
              <Text size="xs" c="dimmed" mt={2}>{t('pet.settings.enableDesc')}</Text>
            </Box>
            <Switch
              checked={enabled}
              onChange={(e) => setEnabled(e.currentTarget.checked)}
              color="blue"
              size="md"
            />
          </Group>
        </Paper>

        {/* Reset position */}
        <Paper p="md" radius="lg" style={{ background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-dim)' }}>
          <Group justify="space-between">
            <Box>
              <Text size="sm" fw={600}>{t('pet.settings.positionLabel')}</Text>
              <Text size="xs" c="dimmed" mt={2}>{t('pet.settings.positionDesc')}</Text>
            </Box>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconRefresh size={14} />}
              onClick={resetPosition}
            >
              {t('pet.settings.resetPosition')}
            </Button>
          </Group>
        </Paper>
      </Stack>

      <Divider />

      {/* ── Bubble settings ──────────────────────────── */}
      <Stack gap={16}>
        <Group gap={8} mb={4}>
          <IconBubble size={18} style={{ color: 'var(--flock-accent)' }} />
          <Text size="sm" fw={700}>{t('pet.settings.bubbleTitle')}</Text>
        </Group>

        <Paper p="md" radius="lg" style={{ background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-dim)' }}>
          <Group justify="space-between" mb={bubbleEnabled ? 16 : 0}>
            <Box>
              <Text size="sm" fw={600}>{t('pet.settings.bubbleEnableLabel')}</Text>
              <Text size="xs" c="dimmed" mt={2}>{t('pet.settings.bubbleEnableDesc')}</Text>
            </Box>
            <Switch
              checked={bubbleEnabled}
              onChange={(e) => setBubbleEnabled(e.currentTarget.checked)}
              color="blue"
              size="md"
            />
          </Group>

          {bubbleEnabled && (
            <>
              <Divider my="md" />
              <Box>
                <Group justify="space-between" mb={8}>
                  <Text size="sm" fw={600}>{t('pet.settings.bubbleDurationLabel')}</Text>
                  <Text size="xs" c="dimmed">{bubbleDuration / 1000}s</Text>
                </Group>
                <Slider
                  min={1000}
                  max={10000}
                  step={500}
                  value={bubbleDuration}
                  onChange={setBubbleDuration}
                  marks={[
                    { value: 1000, label: '1s' },
                    { value: 5000, label: '5s' },
                    { value: 10000, label: '10s' },
                  ]}
                  color="blue"
                />
              </Box>
            </>
          )}
        </Paper>
      </Stack>
    </Stack>
  );
}

const PREVIEW_GLOW: Record<XiaofMood, string> = {
  sleeping: '0 0 20px rgba(107,114,128,0.3)',
  waking:   '0 0 24px rgba(139,92,246,0.5)',
  idle:     '0 0 24px rgba(6,182,212,0.4)',
  thinking: '0 0 24px rgba(245,158,11,0.5)',
  working:  '0 0 24px rgba(16,185,129,0.5)',
  waiting:  '0 0 28px rgba(249,115,22,0.7)',
  takeover: '0 0 28px rgba(236,72,153,0.6)',
  error:    '0 0 24px rgba(239,68,68,0.5)',
};
