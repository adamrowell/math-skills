import { ReactNode, forwardRef } from 'react';
import { GameHeader } from '../GameHeader';
import './AppLayout.css';

interface AppLayoutProps {
  children: ReactNode;
  className?: string;
  variant?: 'selection' | 'playing';
}

/**
 * Main app container - provides consistent background and full-height layout
 */
export const AppLayout = forwardRef<HTMLDivElement, AppLayoutProps>(
  ({ children, className = '', variant }, ref) => {
    const variantClass = variant ? `app-layout--${variant}` : '';
    return (
      <div ref={ref} className={`app-layout ${variantClass} ${className}`}>
        {children}
      </div>
    );
  }
);

AppLayout.displayName = 'AppLayout';

interface SelectionScreenProps {
  children: ReactNode;
  title: string;
  emoji?: string;
  subtitle?: string;
  onBack: () => void;
  className?: string;
}

/**
 * Selection screen layout - for choosing levels/games within an app
 * Provides consistent header with back button and scrollable content
 */
export function SelectionScreen({
  children,
  title,
  emoji,
  subtitle,
  onBack,
  className = '',
}: SelectionScreenProps) {
  return (
    <div className={`selection-screen ${className}`}>
      <header className="selection-screen__header">
        <button className="selection-screen__back" onClick={() => onBack()}>
          <span className="selection-screen__back-arrow">←</span>
          <span className="selection-screen__back-text">Back</span>
        </button>
        <div className="selection-screen__title-area">
          <h1 className="selection-screen__title">
            {emoji && <span className="selection-screen__emoji">{emoji}</span>}
            {title}
            {emoji && <span className="selection-screen__emoji">{emoji}</span>}
          </h1>
          {subtitle && <p className="selection-screen__subtitle">{subtitle}</p>}
        </div>
      </header>
      <div className="selection-screen__content">
        {children}
      </div>
    </div>
  );
}

interface PlayingLayoutProps {
  children: ReactNode;
  // Header props
  gameName: string;
  gameEmoji?: string;
  levelName?: string;
  levelEmoji?: string;
  levelColor?: string;
  timeRemaining?: number;
  showTimer?: boolean;
  onBack: () => void;
  onPause?: () => void;
  onFullscreen?: () => void;
  isPaused?: boolean;
  isFullscreen?: boolean;
  showVoice?: boolean;
  isListening?: boolean;
  voiceSuccess?: boolean;
  transcript?: string;
  stats?: {
    correct?: number;
    progress?: string;
    streak?: number;
    accuracy?: number;
  };
  // Layout options
  showSidebar?: boolean;
  sidebarContent?: ReactNode;
  className?: string;
}

/**
 * Playing layout - consistent game playing interface
 * Includes header, main content area, and optional sidebar
 */
export function PlayingLayout({
  children,
  gameName,
  gameEmoji,
  levelName,
  levelEmoji,
  levelColor,
  timeRemaining,
  showTimer = true,
  onBack,
  onPause,
  onFullscreen,
  isPaused = false,
  isFullscreen = false,
  showVoice = false,
  isListening = false,
  voiceSuccess = false,
  transcript,
  stats,
  showSidebar = true,
  sidebarContent,
  className = '',
}: PlayingLayoutProps) {
  return (
    <div className={`playing-layout ${showSidebar ? '' : 'playing-layout--no-sidebar'} ${className}`}>
      <GameHeader
        gameName={gameName}
        gameEmoji={gameEmoji}
        levelName={levelName}
        levelEmoji={levelEmoji}
        levelColor={levelColor}
        timeRemaining={timeRemaining}
        showTimer={showTimer}
        onBack={onBack}
        onPause={onPause}
        onFullscreen={onFullscreen}
        isPaused={isPaused}
        isFullscreen={isFullscreen}
        showVoice={showVoice}
        isListening={isListening}
        voiceSuccess={voiceSuccess}
        transcript={transcript}
        stats={stats}
      />
      <main className="playing-layout__main">
        {children}
      </main>
      {showSidebar && sidebarContent && (
        <aside className="playing-layout__sidebar">
          {sidebarContent}
        </aside>
      )}
    </div>
  );
}

interface PauseOverlayProps {
  onResume: () => void;
}

/**
 * Pause overlay - consistent pause screen across all apps
 */
export function PauseOverlay({ onResume }: PauseOverlayProps) {
  return (
    <div className="pause-overlay" onClick={onResume}>
      <div className="pause-overlay__content" onClick={(e) => e.stopPropagation()}>
        <h2 className="pause-overlay__title">⏸️ Paused</h2>
        <p className="pause-overlay__subtitle">Take a break! Press Resume when ready.</p>
        <button className="pause-overlay__button" onClick={onResume}>
          ▶️ Resume
        </button>
      </div>
    </div>
  );
}

export default AppLayout;
