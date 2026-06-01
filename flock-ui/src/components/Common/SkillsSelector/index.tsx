import { useState, useMemo, useEffect } from 'react';
import { Box, Text, Group, Stack, ActionIcon, Button, Popover, TextInput, ThemeIcon, Badge } from '@mantine/core';
import { IconX, IconPlus, IconSearch, IconBulb, IconCompass } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useSkillsQuery } from '@/hooks/useToolQueries';
import { useDisclosure } from '@mantine/hooks';

export interface SkillsSelectorProps {
  value: string[];
  onChange: (skills: string[]) => void;
  label?: string;
  placeholder?: string;
  emptyLabel?: string;
}

export function SkillsSelector({
  value = [],
  onChange,
  label,
  placeholder,
  emptyLabel,
}: SkillsSelectorProps) {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);
  const [searchText, setSearchText] = useState('');
  
  const { data: skills = [], isLoading: loadingSkills } = useSkillsQuery();

  // Temporary state for popover draft selection
  const [tempValue, setTempValue] = useState<string[]>(value);
  useEffect(() => {
    if (opened) setTempValue(value);
  }, [opened, value]);

  // Selected skills full objects
  const selectedSkills = useMemo(() => {
    return value
      .map((name) => skills.find((s) => s.name === name))
      .filter((s): s is any => !!s);
  }, [value, skills]);

  // Filter skills in popover by search text
  const filteredSkills = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    return skills.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.display_name && s.display_name.toLowerCase().includes(q)) ||
        s.description.toLowerCase().includes(q)
    );
  }, [skills, searchText]);

  const handleToggleSkill = (skillName: string) => {
    setTempValue((prev) =>
      prev.includes(skillName) ? prev.filter((n) => n !== skillName) : [...prev, skillName]
    );
  };

  const handleRemove = (skillName: string) => {
    onChange(value.filter((n) => n !== skillName));
  };

  const handleConfirm = () => {
    onChange(tempValue);
    close();
  };

  const handleCancel = () => {
    setTempValue(value);
    close();
  };

  const totalCount = value.length;

  return (
    <Stack gap={6}>
      {/* Header with Title and Add Button */}
      <Group justify="space-between" align="center">
        <Group gap={6}>
          <Text size="xs" fw={600} style={{ color: 'var(--flock-text-secondary)' }}>
            {label || t('assistant.form.skillsLabel', '技能列表')}
          </Text>
          {totalCount > 0 && (
            <Text size="xs" c="dimmed">
              {t('assistant.form.skillsBoundCount', { count: totalCount, defaultValue: `已绑定 ${totalCount} 个技能` })}
            </Text>
          )}
        </Group>

        <Popover
          opened={opened}
          onClose={handleCancel}
          width={300}
          position="bottom-end"
          withArrow
          shadow="md"
          closeOnClickOutside
          withinPortal
          styles={{
            dropdown: {
              background: 'var(--flock-bg-raised)',
              border: '1px solid var(--flock-border-dim)',
              borderRadius: 12,
              padding: 14,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              zIndex: 9999,
              maxHeight: '380px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            },
          }}
        >
          <Popover.Target>
            <Button
              size="xs"
              variant="subtle"
              leftSection={<IconPlus size={14} />}
              onClick={open}
              styles={{
                root: {
                  padding: '0 8px',
                  height: 28,
                  fontSize: 12,
                },
              }}
            >
              {t('assistant.form.addSkills', '添加技能')}
            </Button>
          </Popover.Target>

          <Popover.Dropdown onClick={(e) => e.stopPropagation()}>
            <Stack gap="xs" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Group justify="space-between" align="center">
                <Text fw={700} size="sm" style={{ color: 'var(--flock-text-bright)' }}>
                  {t('assistant.form.selectSkills', '选择技能')}
                </Text>
                <IconX
                  size={16}
                  style={{ cursor: 'pointer', color: 'var(--flock-text-dim)' }}
                  onClick={handleCancel}
                />
              </Group>

              <TextInput
                placeholder={placeholder || t('assistant.form.skillsPlaceholder', '搜索技能...')}
                leftSection={<IconSearch size={14} style={{ color: 'var(--flock-text-dim)' }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.currentTarget.value)}
                styles={{
                  input: { background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-dim)', height: 32, fontSize: 12 },
                }}
              />

              <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
                {loadingSkills ? (
                  <Text size="xs" c="dimmed" ta="center" py="xl">{t('common.loading')}</Text>
                ) : filteredSkills.length === 0 ? (
                  <Text size="xs" c="dimmed" ta="center" py="xl">{t('assistant.form.noMatchingSkills', '无匹配的技能')}</Text>
                ) : (
                  <Stack gap={4}>
                    {filteredSkills.map((s) => {
                      const isSelected = tempValue.includes(s.name);
                      return (
                        <Box
                          key={s.name}
                          onClick={() => handleToggleSkill(s.name)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 10px',
                            borderRadius: 6,
                            background: isSelected ? 'var(--flock-bg-hover)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Group justify="space-between" align="center" style={{ width: '100%' }}>
                            <Box style={{ flex: 1 }}>
                              <Text fw={600} size="xs" style={{ color: 'var(--flock-text-bright)' }}>
                                {s.display_name || s.name}
                              </Text>
                              <Text size="10px" c="dimmed" lineClamp={1}>
                                {s.description}
                              </Text>
                            </Box>
                            {isSelected && (
                              <Badge size="xs" color="blue" variant="light">{t('assistant.form.addedTag', '已选择')}</Badge>
                            )}
                          </Group>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Box>

              <Group justify="flex-end" pt="xs" gap="xs" style={{ borderTop: '1px solid var(--flock-border-subtle)' }}>
                <Button variant="subtle" size="xs" onClick={handleCancel}>
                  {t('common.cancel')}
                </Button>
                <Button variant="filled" color="blue" size="xs" onClick={handleConfirm} style={{ background: 'var(--flock-accent)' }}>
                  {t('common.confirm')}
                </Button>
              </Group>
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>

      {/* Skills Card List */}
      {totalCount === 0 ? (
        <Box
          style={{
            padding: '14px 12px',
            borderRadius: 8,
            border: '1px dashed var(--flock-border-dim)',
            textAlign: 'center',
          }}
        >
          <Text size="xs" c="dimmed">
            {emptyLabel || t('assistant.form.noSkillsBound', '未绑定技能，该节点将无法调用任何技能')}
          </Text>
        </Box>
      ) : (
        <Stack gap={6}>
          {selectedSkills.map((skill) => (
            <Box
              key={skill.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <ThemeIcon size={28} radius="md" style={{ background: 'rgba(20, 110, 245, 0.08)', color: 'var(--flock-accent)' }}>
                {skill.name.includes('pptx') ? <IconCompass size={16} /> : <IconBulb size={16} />}
              </ThemeIcon>

              <Box style={{ flex: 1, minWidth: 0 }}>
                <Group gap={6} align="center">
                  <Text fw={600} size="xs" style={{ color: 'var(--flock-text-bright)' }} lineClamp={1}>
                    {skill.display_name || skill.name}
                  </Text>
                  <Badge size="9px" radius="sm" variant="light" color={skill.source === 'User' ? 'teal' : 'gray'}>
                    {skill.source === 'User' ? 'USER' : 'BUNDLED'}
                  </Badge>
                </Group>
                <Text size="10px" c="dimmed" lineClamp={1} mt={2}>
                  {skill.description}
                </Text>
              </Box>

              <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleRemove(skill.name)}>
                <IconX size={14} />
              </ActionIcon>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export default SkillsSelector;
