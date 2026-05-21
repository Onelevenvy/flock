import { Select, Group, Text, Tooltip, type SelectProps, type ComboboxItem } from '@mantine/core';
import { ModelIcon } from './Icons/DynamicIcon';

export interface ModelSelectItem extends ComboboxItem {
  /** provider.id，用于图标文件查找（如 openai, deepseek） */
  providerName?: string;
}

export interface ModelSelectGroup {
  group: string;
  items: ModelSelectItem[];
}

export interface ModelSelectProps
  extends Omit<SelectProps, 'data' | 'renderOption'> {
  data: ModelSelectGroup[] | ModelSelectItem[];
}

/** 下拉选项行渲染：icon + 省略文字 + Tooltip */
function ModelOptionItem({ option }: { option: ComboboxItem & { providerName?: string } }) {
  return (
    <Group
      gap={6}
      wrap="nowrap"
      style={{
        minWidth: 0,
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <ModelIcon
        name={option.value}
        provider={option.providerName ?? ''}
        size={14}
        style={{ flexShrink: 0 }}
      />
      <Tooltip label={option.label} withArrow openDelay={400} position="right">
        {/* span 作为 Tooltip 的单一子元素，必须能接收 ref */}
        <Text
          component="span"
          size="xs"
          style={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: 1,
          }}
        >
          {option.label}
        </Text>
      </Tooltip>
    </Group>
  );
}

/**
 * 通用模型选择器
 * - 下拉选项带 provider 图标
 * - 名称过长时省略 + Tooltip 显示完整名称
 * - 支持 Mantine Select 的所有 props
 */
export function ModelSelect({ data, value, styles, ...rest }: ModelSelectProps) {
  // 平铺所有 item，找到当前选中项的 providerName 用于左侧图标
  const allItems: ModelSelectItem[] = (data as any[]).flatMap((d: any) =>
    d.items ? d.items : [d]
  );
  const selectedItem = allItems.find((item) => item.value === value);

  return (
    <Select
      data={data as any}
      value={value}
      renderOption={({ option }) => (
        <ModelOptionItem option={option as any} />
      )}
      leftSection={
        selectedItem ? (
          <ModelIcon
            name={selectedItem.value}
            provider={selectedItem.providerName ?? ''}
            size={12}
            style={{ flexShrink: 0 }}
          />
        ) : undefined
      }
      leftSectionWidth={selectedItem ? 22 : undefined}
      styles={{
        input: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          ...(styles as any)?.input,
        },
        option: {
          // 确保 option 容器不会撑开
          overflow: 'hidden',
          ...(styles as any)?.option,
        },
        ...styles,
      }}
      {...rest}
    />
  );
}
