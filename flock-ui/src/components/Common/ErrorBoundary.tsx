import { Component, ErrorInfo, ReactNode } from 'react';
import i18n from '../../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1b1e', color: '#c1c2c5', fontFamily: 'sans-serif' }}>
          <div style={{ padding: '24px', background: '#25262b', borderRadius: '8px', border: '1px solid #373a40', maxWidth: '600px', width: '100%' }}>
            <h2 style={{ color: '#ff6b6b', marginTop: 0 }}>{i18n.t('common.errors.errorBoundaryTitle')}</h2>
            <p style={{ fontSize: '14px', color: '#909296' }}>{i18n.t('common.errors.errorBoundaryDesc')}</p>
            
            <pre style={{ background: '#141517', padding: '12px', borderRadius: '4px', overflowX: 'auto', fontSize: '12px', color: '#ff8787', border: '1px solid #373a40' }}>
              {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
            </pre>

            <button 
              onClick={() => window.location.reload()}
              style={{ background: '#4c6ef5', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', marginTop: '16px', fontSize: '14px' }}
            >
              {i18n.t('common.errors.retryLoad')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
