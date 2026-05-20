import React, { useState, useEffect } from 'react';
import { IconProps } from './index';

export interface DynamicIconProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  category: 'providers' | 'tools' | 'models';
  name: string;
  fallbackName?: string;
  size?: number | string;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({
  category,
  name,
  fallbackName,
  size = 24,
  style,
  className,
  ...props
}) => {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!name) {
      setImgSrc('/icons/models/default-fallback.svg');
      return;
    }

    const trimmedName = name.trim();
    
    // 如果是完整的 URL 或 Base64 编码，直接作为 src
    if (
      trimmedName.startsWith('data:') ||
      trimmedName.startsWith('http:') ||
      trimmedName.startsWith('https:') ||
      trimmedName.startsWith('asset:')
    ) {
      setImgSrc(trimmedName);
    } else {
      // 拼接本地静态文件路径
      const normalizedName = trimmedName.toLowerCase();
      setImgSrc(`/icons/${category}/${normalizedName}.svg`);
    }
    setRetryCount(0);
  }, [category, name]);

  const handleError = () => {
    if (retryCount === 0) {
      // 第一次失败尝试：如果具体模型找不到图标，尝试使用提供商图标
      if (category === 'models' && fallbackName) {
        const normalizedFallback = fallbackName.trim().toLowerCase();
        setImgSrc(`/icons/providers/${normalizedFallback}.svg`);
        setRetryCount(1);
      } else {
        // 直接使用默认降级图标
        setImgSrc('/icons/models/default-fallback.svg');
        setRetryCount(2);
      }
    } else if (retryCount === 1) {
      // 第二次失败尝试：提供商图标也找不到，使用最终默认降级图标
      setImgSrc('/icons/models/default-fallback.svg');
      setRetryCount(2);
    }
  };

  return (
    <img
      src={imgSrc}
      alt={name}
      width={size}
      height={size}
      style={{
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style,
      }}
      className={className}
      onError={handleError}
      {...(props as any)}
    />
  );
};

// Helper component to render provider icons alongside stylized text
const LongIconWrapper: React.FC<{ name: string; label: string; size?: number | string }> = ({
  name,
  label,
  size = 20,
}) => {
  const height = typeof size === 'number' ? size : parseFloat(size as string) || 20;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height }}>
      <DynamicIcon category="providers" name={name} size={height} />
      <span
        style={{
          fontSize: height * 0.7,
          fontWeight: 700,
          letterSpacing: 0.5,
          color: 'var(--flock-text-bright)',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {label}
      </span>
    </div>
  );
};

// --- Unified Shared Wrappers ---

export interface ProviderIconProps extends Omit<DynamicIconProps, 'category' | 'name'> {
  name?: string;
}

export const ProviderIcon: React.FC<ProviderIconProps & React.ImgHTMLAttributes<HTMLImageElement>> = ({
  name = '',
  size = 24,
  ...props
}) => {
  return <DynamicIcon category="providers" name={name} size={size} {...props} />;
};

export const ProviderIconLong: React.FC<ProviderIconProps & React.ImgHTMLAttributes<HTMLImageElement>> = ({
  name = '',
  size = 24,
  ...props
}) => {
  const normalizedKey = name.toLowerCase().trim();
  
  let matchedLabel = name.toUpperCase();
  let matchedKey = normalizedKey;
  
  if (normalizedKey.includes('openai')) {
    matchedKey = 'openai';
    matchedLabel = 'OPENAI';
  } else if (normalizedKey.includes('zhipu') || normalizedKey.includes('chatglm')) {
    matchedKey = 'zhipuai';
    matchedLabel = 'ZHIPUAI';
  } else if (normalizedKey.includes('ollama')) {
    matchedKey = 'ollama';
    matchedLabel = 'OLLAMA';
  } else if (normalizedKey.includes('siliconflow')) {
    matchedKey = 'siliconflow';
    matchedLabel = 'SILICONFLOW';
  } else if (normalizedKey.includes('qwen')) {
    matchedKey = 'qwen';
    matchedLabel = 'QWEN';
  } else if (normalizedKey.includes('google') || normalizedKey.includes('gemini')) {
    matchedKey = 'google';
    matchedLabel = 'GEMINI';
  } else if (normalizedKey.includes('xinference')) {
    matchedKey = 'xinference';
    matchedLabel = 'XINFERENCE';
  } else if (normalizedKey.includes('anthropic') || normalizedKey.includes('anthrapic')) {
    matchedKey = 'anthropic';
    matchedLabel = 'ANTHROPIC';
  } else if (normalizedKey.includes('deepseek')) {
    matchedKey = 'deepseek';
    matchedLabel = 'DEEPSEEK';
  }

  return <LongIconWrapper name={matchedKey} label={matchedLabel} size={size} />;
};

export const ModelProviderIconLong = ProviderIconLong;

export interface ModelIconProps extends IconProps {
  name: string;
  provider?: string;
}

export const ModelIcon: React.FC<ModelIconProps & React.ImgHTMLAttributes<HTMLImageElement>> = ({
  name = '',
  provider = '',
  size = 24,
  ...props
}) => {
  const modelName = name.toLowerCase().trim();
  const providerName = provider.toLowerCase().trim();

  let matchedKey = modelName;
  let fallbackKey = providerName;

  if (providerName.includes('openai') || modelName.startsWith('gpt') || modelName.startsWith('o1') || modelName.startsWith('o3')) {
    fallbackKey = 'openai';
    matchedKey = modelName.startsWith('o1') || modelName.startsWith('o3') ? 'openai-o1' : 'openai';
  } else if (providerName.includes('zhipu') || modelName.includes('glm') || modelName.includes('chatglm')) {
    fallbackKey = 'zhipuai';
    matchedKey = 'zhipuai';
  } else if (providerName.includes('deepseek') || modelName.includes('deepseek')) {
    fallbackKey = 'deepseek';
    matchedKey = 'deepseek';
  } else if (providerName.includes('ollama') || modelName.includes('ollama')) {
    fallbackKey = 'ollama';
    matchedKey = 'ollama';
  } else if (providerName.includes('siliconflow') || modelName.includes('siliconflow')) {
    fallbackKey = 'siliconflow';
    matchedKey = 'siliconflow';
  } else if (providerName.includes('qwen') || modelName.includes('qwen')) {
    fallbackKey = 'qwen';
    matchedKey = 'qwen';
  } else if (providerName.includes('google') || modelName.includes('gemini')) {
    fallbackKey = 'google';
    matchedKey = 'google';
  } else if (providerName.includes('xinference') || modelName.includes('xinference')) {
    fallbackKey = 'xinference';
    matchedKey = 'xinference';
  }

  return (
    <DynamicIcon
      category="models"
      name={matchedKey}
      fallbackName={fallbackKey}
      size={size}
      {...props}
    />
  );
};

export interface ToolsIconProps extends IconProps {
  name: string;
}

export const ToolsIcon: React.FC<ToolsIconProps & React.ImgHTMLAttributes<HTMLImageElement>> = ({
  name = '',
  size = 24,
  ...props
}) => {
  const normalizedKey = name.toLowerCase().trim();
  
  let matchedKey = normalizedKey;
  let matchedCategory: 'tools' | 'providers' = 'tools';

  if (normalizedKey.includes('tavily')) {
    matchedKey = 'tavily_search';
  } else if (normalizedKey.includes('weather')) {
    matchedKey = 'openweather';
  } else if (normalizedKey.includes('duckduckgo')) {
    matchedKey = 'duckduckgo';
  } else if (normalizedKey.includes('wikipedia')) {
    matchedKey = 'wikipedia';
  } else if (normalizedKey.includes('translate') || normalizedKey.includes('google')) {
    matchedKey = 'google';
  } else if (normalizedKey.includes('math') || normalizedKey.includes('calc') || normalizedKey.includes('calculator')) {
    matchedKey = 'calculator';
  } else if (normalizedKey.includes('serper')) {
    matchedKey = 'serper';
  } else if (normalizedKey.includes('baidu')) {
    matchedKey = 'baidu';
  } else if (normalizedKey.includes('time')) {
    matchedKey = 'get_current_time';
  } else if (normalizedKey.includes('mcp')) {
    matchedKey = 'mcp';
  } else if (normalizedKey.includes('workflow')) {
    matchedKey = 'workflow';
  } else if (normalizedKey.includes('spark')) {
    matchedKey = 'spark';
  } else if (normalizedKey.includes('siliconflow')) {
    matchedKey = 'siliconflow';
    matchedCategory = 'providers';
  } else if (normalizedKey.includes('zhipu')) {
    matchedKey = 'zhipuai';
    matchedCategory = 'providers';
  } else if (normalizedKey.includes('builtin') || normalizedKey.includes('bash')) {
    matchedKey = 'bash';
  }

  return <DynamicIcon category={matchedCategory} name={matchedKey} size={size} {...props} />;
};
