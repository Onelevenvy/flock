import React, { useState, useEffect } from 'react';
import { IconProps } from './index';

export interface DynamicIconProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  category: 'providers' | 'tools' | 'models';
  name: string;
  fallbackName?: string;
  size?: number | string;
}

const normalizeIconName = (name: string): string => {
  const trimmed = name.trim();
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http:') ||
    trimmed.startsWith('https:') ||
    trimmed.startsWith('asset:')
  ) {
    return trimmed;
  }
  return trimmed.toLowerCase();
};

const getInitialSrc = (category: string, name: string): string => {
  if (!name) return '';
  const normalized = normalizeIconName(name);
  if (
    normalized.startsWith('data:') ||
    normalized.startsWith('http:') ||
    normalized.startsWith('https:') ||
    normalized.startsWith('asset:')
  ) {
    return normalized;
  }
  if (normalized === 'follow') {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23228be6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 0 1-9-9z"/><path d="M19 3a3 3 0 0 0 3 3 3 3 0 0 1-3-3z"/><path d="M14 14a3 3 0 0 0 3 3 3 3 0 0 1-3-3z"/></svg>`;
  }
  return `/icons/${category}/${normalized}.svg`;
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
        const normalizedFallback = fallbackName.trim();
        if (
          normalizedFallback.startsWith('data:') ||
          normalizedFallback.startsWith('http:') ||
          normalizedFallback.startsWith('https:') ||
          normalizedFallback.startsWith('asset:')
        ) {
          setImgSrc(normalizedFallback);
        } else {
          setImgSrc(`/icons/providers/${normalizedFallback.toLowerCase()}.svg`);
        }
        setRetryCount(1);
      } else if (category === 'tools') {
        const normalizedName = name.trim().toLowerCase();
        setImgSrc(`/icons/providers/${normalizedName}.svg`);
        setRetryCount(1);
      } else {
        setImgSrc('');
        setRetryCount(2);
      }
    } else if (retryCount === 1) {
      setImgSrc('');
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
  const matchedKey = normalizeIconName(name);
  return <DynamicIcon category="providers" name={matchedKey} size={size} {...props} />;
};

export const ProviderIconLong: React.FC<ProviderIconProps & React.ImgHTMLAttributes<HTMLImageElement>> = ({
  name = '',
  size = 24,
  ...props
}) => {
  const matchedKey = normalizeIconName(name);
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
  const trimmed = provider.trim();
  const providerName = (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http:') ||
    trimmed.startsWith('https:') ||
    trimmed.startsWith('asset:')
  ) ? trimmed : trimmed.toLowerCase();

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
  const normalizedKey = normalizeIconName(name);
  return <DynamicIcon category="tools" name={normalizedKey} size={size} {...props} />;
};
