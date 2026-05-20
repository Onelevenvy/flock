import React, { useState, useEffect } from 'react';
import { IconProps } from './index';

export interface DynamicIconProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  category: 'providers' | 'tools' | 'models';
  name: string;
  fallbackName?: string;
  size?: number | string;
}

const getInitialSrc = (category: string, name: string): string => {
  if (!name) return '/icons/models/default-fallback.svg';
  const trimmedName = name.trim();
  if (
    trimmedName.startsWith('data:') ||
    trimmedName.startsWith('http:') ||
    trimmedName.startsWith('https:') ||
    trimmedName.startsWith('asset:')
  ) {
    return trimmedName;
  }
  return `/icons/${category}/${trimmedName.toLowerCase()}.svg`;
};

export const DynamicIcon: React.FC<DynamicIconProps> = ({
  category,
  name,
  fallbackName,
  size = 24,
  style,
  className,
  ...props
}) => {
  const [imgSrc, setImgSrc] = useState<string>(() => getInitialSrc(category, name));
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setImgSrc(getInitialSrc(category, name));
    setRetryCount(0);
  }, [category, name]);

  const handleError = () => {
    if (retryCount === 0) {
      if (category === 'models' && fallbackName) {
        const normalizedFallback = fallbackName.trim().toLowerCase();
        setImgSrc(`/icons/providers/${normalizedFallback}.svg`);
        setRetryCount(1);
      } else if (category === 'tools') {
        const normalizedName = name.trim().toLowerCase();
        setImgSrc(`/icons/providers/${normalizedName}.svg`);
        setRetryCount(1);
      } else {
        setImgSrc('/icons/models/default-fallback.svg');
        setRetryCount(2);
      }
    } else if (retryCount === 1) {
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
        flexShrink: 0,
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
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height, flexShrink: 0 }}>
      <DynamicIcon category="providers" name={name} size={height} style={{ flexShrink: 0 }} />
      <span
        style={{
          fontSize: height * 0.7,
          fontWeight: 700,
          letterSpacing: 0.5,
          color: 'var(--flock-text-bright)',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          flexShrink: 0,
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
  const matchedKey = name.toLowerCase().trim();
  return <DynamicIcon category="providers" name={matchedKey} size={size} {...props} />;
};

export const ProviderIconLong: React.FC<ProviderIconProps & React.ImgHTMLAttributes<HTMLImageElement>> = ({
  name = '',
  size = 24,
  ...props
}) => {
  const matchedKey = name.toLowerCase().trim();
  const matchedLabel = name.trim().toUpperCase();
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

  return (
    <DynamicIcon
      category="models"
      name={modelName}
      fallbackName={providerName}
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
  return <DynamicIcon category="tools" name={normalizedKey} size={size} {...props} />;
};
