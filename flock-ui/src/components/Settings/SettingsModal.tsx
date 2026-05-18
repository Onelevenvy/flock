import { useState } from 'react';
import {
  Modal,
  Group,
  Text,
  Box,
  Stack,
  UnstyledButton,
  ThemeIcon,
  Divider,
  ScrollArea,
} from '@mantine/core';
import {
  IconSettings,
  IconBox,
  IconAdjustmentsHorizontal,
  IconDeviceDesktop,
} from '@tabler/icons-react';
import ModelProviderPage from './ModelProvider';
import XiaofSettings from './XiaofSettings';
import SystemSettings from './SystemSettings';
import { useTranslation } from 'react-i18next';

interface Props {
  opened: boolean;
  onClose: () => void;
}

interface NavItem {
  key: string;
  label: string;
  icon: typeof IconSettings;
  description?: string;
}

export default function SettingsModal({ opened, onClose }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('model');

  const navItems: NavItem[] = [
    { key: 'model', label: t('settings.tabs.model'), icon: IconBox, description: t('settings.descriptions.model') },
    { key: 'basic', label: t('settings.tabs.basic'), icon: IconAdjustmentsHorizontal, description: t('settings.descriptions.basic') },
    { key: 'system', label: t('settings.tabs.system'), icon: IconDeviceDesktop, description: t('settings.descriptions.system') },
  ];

  const currentItem = navItems.find((i) => i.key === activeTab);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon variant="light" color="indigo" size="md" radius="md">
            <IconSettings size={18} />
          </ThemeIcon>
          <Text fw={700} size="lg" style={{ letterSpacing: '0.5px' }}>{t('settings.title')}</Text>
        </Group>
      }
      size="100%"
      padding={0}
      styles={{
        content: {
          background: 'var(--flock-bg-deep)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          borderRadius: 0,
        },
        header: {
          background: 'var(--flock-bg-deep)',
          borderBottom: '1px solid var(--flock-border-subtle)',
          padding: '16px 24px',
          minHeight: 'auto',
        },
        body: {
          padding: 0,
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        },
        close: {
          color: 'var(--flock-text-dim)',
          '&:hover': {
            background: 'var(--flock-bg-hover)',
          },
        }
      }}
    >
      <Group
        align="flex-start"
        style={{ width: '100%', height: '100%' }}
        gap={0}
        wrap="nowrap"
      >
        {/* Left Navigation */}
        <Box
          style={{
            width: 260,
            minWidth: 260,
            height: '100%',
            background: 'var(--flock-bg-deepest)',
            borderRight: '1px solid var(--flock-border-subtle)',
            padding: '24px 16px',
          }}
        >
          
          <Stack gap={6}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <UnstyledButton
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: isActive
                      ? 'var(--flock-accent-soft)'
                      : 'transparent',
                    color: 'var(--flock-text-dim)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  className="settings-nav-item"
                >
                  <Icon 
                    size={20} 
                    stroke={isActive ? 2.5 : 1.5}
                    style={{
                      filter: isActive ? 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.4))' : 'none'
                    }}
                  />
                  <Box style={{ flex: 1 }}>
                    <Text size="sm" fw={isActive ? 600 : 500}>
                      {item.label}
                    </Text>
                  </Box>
                </UnstyledButton>
              );
            })}
          </Stack>

          <Box style={{ position: 'absolute', bottom: 24, left: 16, right: 16 }}>
            <Divider mb="sm" color="dark.5" />
            <Text size="xs" c="dimmed" ta="center">{t('settings.version')}</Text>
          </Box>
        </Box>

        {/* Right Content */}
        <ScrollArea
          h="100%"
          style={{
            flex: 1,
            background: 'var(--flock-bg-deep)',
          }}
          type="hover"
          offsetScrollbars
        >
          <Box style={{ padding: '32px 40px' }}>
            <Box mb={40}>
              <Text size="24px" fw={700} mb={4}>
                {currentItem?.label}
              </Text>
              <Text size="sm" c="dimmed">
                {currentItem?.description}
              </Text>
            </Box>

            <Box style={{ maxWidth: 900 }}>
              {activeTab === 'basic' && <XiaofSettings />}
              {activeTab === 'system' && <SystemSettings />}
              {activeTab === 'model' && <ModelProviderPage />}
              {activeTab === 'tool' && <PlaceholderPage title={t('settings.tabs.tool')} />}
            </Box>
          </Box>
        </ScrollArea>
      </Group>
    </Modal>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <Box 
      p={40} 
      style={{ 
        border: '1px dashed var(--flock-border-dim)', 
        borderRadius: 16,
        textAlign: 'center'
      }}
    >
      <Text c="dimmed" size="sm">
        {title} {t('settings.developing')}
      </Text>
    </Box>
  );
}
