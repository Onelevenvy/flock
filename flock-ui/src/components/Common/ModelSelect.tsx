import { forwardRef } from 'react';
import { Select, Group, Text, Tooltip, type SelectProps, type ComboboxItem } from '@mantine/core';
import { ModelIcon } from '../Icons/DynamicIcon';

export interface ModelSelectItem extends ComboboxItem {
  /** provider_type，用于 fallback 图标查找 */
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

/** 选项行渲染 */
function ModelOptionItem({ option }: { option: ComboboxItem & { providerName?: string } }) {
  return (
    <Group gap={6} wrap="nowrap" style={{ minWidth: 0, width: '100%' }}>
      <ModelIcon
        name={option.value}
        provider={option.providerName ?? ''}
        size={14}
        style={{ flexShrink: 0 }}
      />
      <Tooltip label={option.label} withArrow openDelay={500} position="right">
        <Text
          size="xs"
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}
        >
          {option.label}
        </Text>
      </Tooltip>
    </Group>
  );
}

/** 已选中时 input 区域内的展示（icon + ellipsis text） */
const ModelValueRenderer = forwardRef<
  HTMLDivElement,
  { label: string; providerName?: string; value: string }
>(({ label, providerName, value }, ref) => (
  <Group
    ref={ref}
    gap={5}
    wrap="nowrap"
    style={{ minWidth: 0, width: '100%', overflow: 'hidden' }}
  >
    <ModelIcon
      name={value}
      provider={providerName ?? ''}
      size={12}
      style={{ flexShrink: 0 }}
    />
    <Tooltip label={label} withArrow openDelay={600} position="bottom">
      <Text
        size="xs"
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
        }}
      >
        {label}
      </Text>
    </Tooltip>
  </Group>
));
ModelValueRenderer.displayName = 'ModelValueRenderer';

/**
 * 通用模型选择器
 * - 下拉选项带 provider 图标
 * - 名称过长时省略 + Tooltip 显示完整名称
 * - 支持 Mantine Select 的所有 props
 */
export function ModelSelect({ data, value, styles, ...rest }: ModelSelectProps) {
  // 平铺所有 item，方便查找当前选中项的 providerName
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
      // 自定义 input 内的内容展示
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
        ...styles,
      }}
      {...rest}
    />
  );
}
