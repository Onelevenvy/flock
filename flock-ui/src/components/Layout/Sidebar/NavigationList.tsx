import { useState } from 'react';
import { Stack, UnstyledButton, Group, Text, Collapse } from '@mantine/core';
import {
  IconHome,
  IconRobot,
  IconBolt,
  IconCalendarTime,
  IconRoute,
  IconBoxMultiple,
  IconLego,
  IconLayoutGrid,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react';
import { useUiStore } from '../../../store/uiStore';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { useWorkflowStore } from '../../../store/workflowStore';
import { useTranslation } from 'react-i18next';

export function NavigationList() {
  const { t } = useTranslation();
  const { currentView, setCurrentView } = useUiStore();
  const { activeConversationId, setActiveConversation } = useWorkspaceStore();
  const { activeWorkflowId, setActiveWorkflowId, isDirty } = useWorkflowStore();
  const [moreOpened, setMoreOpened] = useState(false);

  const PRIMARY_MENUS = [
    { label: t('sidebar.home'), icon: IconHome, view: 'home' as const },
    { label: t('sidebar.assistant'), icon: IconRobot, view: 'assistant' as const },
    { label: t('sidebar.workflow'), icon: IconRoute, view: 'workflow' as const },
  ];

  const SECONDARY_MENUS = [
    { label: t('sidebar.schedule'), icon: IconCalendarTime, view: 'schedule' as const },
    { label: t('sidebar.skills'), icon: IconBolt, view: 'skills' as const },
    { label: t('sidebar.collaboration'), icon: IconBoxMultiple, view: 'collaboration' as const },
    { label: t('sidebar.extension'), icon: IconLego, view: 'extension' as const },
  ];

  return (
    <Stack gap={2} px="md" py="xs">
      {PRIMARY_MENUS.map(menu => {
        const isActive = currentView === menu.view && (menu.view !== 'home' || !activeConversationId);
        return (
          <UnstyledButton
            key={menu.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              borderRadius: 8,
              color: isActive ? 'var(--flock-accent)' : 'var(--flock-text-secondary)',
              background: isActive ? 'var(--flock-accent-soft)' : 'transparent',
              fontWeight: isActive ? 600 : 500,
              transition: 'all 0.2s ease',
            }}
            onClick={() => {
              if (menu.view === 'workflow') {
                if (currentView === 'workflow' && activeWorkflowId) {
                  if (isDirty) {
                    if (window.confirm(t('workflow.unsavedConfirm'))) {
                      setActiveWorkflowId(null);
                    }
                  } else {
                    setActiveWorkflowId(null);
                  }
                }
                setCurrentView('workflow');
              } else {
                setCurrentView(menu.view);
                if (menu.view === 'home') setActiveConversation(null);
              }
            }}
          >
            <menu.icon size={20} />
            <Text size="sm">{menu.label}</Text>
          </UnstyledButton>
        );
      })}

      <UnstyledButton
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderRadius: 8,
          color: 'var(--flock-text-secondary)',
          marginTop: 4,
        }}
        onClick={() => setMoreOpened(!moreOpened)}
      >
        <Group gap={12}>
          <IconLayoutGrid size={20} />
          <Text size="sm" fw={500}>{t('sidebar.more')}</Text>
        </Group>
        {moreOpened ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
      </UnstyledButton>

      <Collapse in={moreOpened}>
        <Stack gap={2} mt={2}>
          {SECONDARY_MENUS.map(menu => {
            const isActive = currentView === menu.view;
            return (
              <UnstyledButton
                key={menu.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  borderRadius: 8,
                  color: isActive ? 'var(--flock-accent)' : 'var(--flock-text-secondary)',
                  background: isActive ? 'var(--flock-accent-soft)' : 'transparent',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.2s ease',
                }}
                onClick={() => setCurrentView(menu.view)}
              >
                <menu.icon size={20} />
                <Text size="sm">{menu.label}</Text>
              </UnstyledButton>
            );
          })}
        </Stack>
      </Collapse>
    </Stack>
  );
}
