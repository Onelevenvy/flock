import { Select, type SelectProps, type ComboboxItem } from '@mantine/core';
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

/**
 * 下拉选项行渲染：icon + 省略文字（hover 显示 title）
 *
 * 关键：不使用 Tooltip（会干扰 flex 尺寸计算），改用 HTML title 属性。
 * 使用 flex:'1 1 0' + width:0 而非 flex:1+minWidth:0，
 * 因为 basis=0 才能让浏览器从零开始分配剩余空间，确保 ellipsis 正确触发。
 */
function ModelOptionItem({ option }: { option: ComboboxItem & { providerName?: string } }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <ModelIcon
        name={option.value}
        provider={option.providerName ?? ''}
        size={14}
        style={{ flexShrink: 0 }}
      />
      <span
        title={option.label}
        style={{
          flex: '1 1 0',
          width: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 'var(--mantine-font-size-xs)',
          lineHeight: 'var(--mantine-line-height-xs)',
          color: 'inherit',
        }}
      >
        {option.label}
      </span>
    </div>
  );
}

/**
 * 通用模型选择器
 * - 下拉选项带 provider 图标
 * - 名称过长时省略（hover 显示 HTML title 完整名称）
 * - 支持 Mantine Select 的所有 props
 */
export function ModelSelect({ data, value, styles, ...rest }: ModelSelectProps) {
  // 平铺所有 item，找到当前选中项的 providerName 用于左侧图标
  const allItems: ModelSelectItem[] = (data as any[]).flatMap((d: any) =>
    d.items ? d.items : [d]
  );
  const selectedItem = allItems.find((item) => item.value === value);

  // 从外部 styles 中提取各部分，将我们的 base styles 与调用方的 styles 合并
  // 注意：不能在最后做 ...styles 展开，否则会覆盖掉我们设置的 input/option
  const callerStyles = (styles ?? {}) as Record<string, any>;
  const mergedStyles: Record<string, any> = {
    ...callerStyles,
    input: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      ...callerStyles.input,
    },
    option: {
      // 确保 option 容器不会撑开下拉菜单
      overflow: 'hidden',
      minWidth: 0,
      ...callerStyles.option,
    },
  };

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
      styles={mergedStyles}
      {...rest}
    />
  );
}
