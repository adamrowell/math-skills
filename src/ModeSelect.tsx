import { useState, useEffect } from 'react';
import { GameMode } from './config/readingConfig';
import { getGameModeStats, getOverallStats } from './utils/progressStorage';
import './ModeSelect.css';

interface ModeSelectProps {
  onSelectMode: (mode: GameMode) => void;
}

interface ModeStats {
  gamesPlayed: number;
  levelsCompleted: number;
  accuracy: number;
}

export function ModeSelect({ onSelectMode }: ModeSelectProps) {
  const [modeStats, setModeStats] = useState<Record<string, ModeStats>>({});
  const [overallStats, setOverallStats] = useState<{ totalGamesPlayed: number; currentStreak: number }>({
    totalGamesPlayed: 0,
    currentStreak: 0,
  });

  // Load progress stats on mount
  useEffect(() => {
    const stats: Record<string, ModeStats> = {};
    const modes = ['math', 'reading', 'geography', 'charts', 'comparison', 'tables', 'arcade', 'algebra', 'wordProblems'] as const;

    modes.forEach(mode => {
      const s = getGameModeStats(mode);
      stats[mode] = {
        gamesPlayed: s.totalGamesPlayed,
        levelsCompleted: s.levelsCompleted,
        accuracy: s.accuracy,
      };
    });

    // Combine math-related modes for the math card
    stats['math-combined'] = {
      gamesPlayed: stats.math.gamesPlayed + stats.comparison.gamesPlayed + stats.tables.gamesPlayed,
      levelsCompleted: stats.math.levelsCompleted + stats.comparison.levelsCompleted + stats.tables.levelsCompleted,
      accuracy: Math.round((stats.math.accuracy + stats.comparison.accuracy + stats.tables.accuracy) / 3) || 0,
    };

    setModeStats(stats);
    setOverallStats(getOverallStats());
  }, []);

  const renderProgressBadge = (stats: ModeStats | undefined) => {
    if (!stats || stats.gamesPlayed === 0) return null;

    return (
      <div className="mode-select__card-progress">
        {stats.levelsCompleted > 0 && (
          <span className="mode-select__card-badge" title={`${stats.levelsCompleted} levels completed`}>
            {stats.levelsCompleted} ✓
          </span>
        )}
        {stats.gamesPlayed > 0 && (
          <span className="mode-select__card-plays" title={`${stats.gamesPlayed} games played`}>
            {stats.gamesPlayed}x
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="mode-select">
      <div className="mode-select__header">
        <h1 className="mode-select__title">
          <span className="mode-select__emoji">🌟</span>
          Learning Skills
          <span className="mode-select__emoji">🌟</span>
        </h1>
        <p className="mode-select__subtitle">
          Choose what you want to practice today!
        </p>
        {overallStats.totalGamesPlayed > 0 && (
          <div className="mode-select__overall-stats">
            <span>{overallStats.totalGamesPlayed} games played</span>
            {overallStats.currentStreak > 0 && (
              <span className="mode-select__streak">🔥 {overallStats.currentStreak} day streak!</span>
            )}
          </div>
        )}
      </div>

      <div className="mode-select__cards">
        <button
          className="mode-select__card mode-select__card--math"
          onClick={() => onSelectMode('math')}
        >
          {renderProgressBadge(modeStats['math-combined'])}
          <div className="mode-select__card-icon">🔢</div>
          <h2 className="mode-select__card-title">Math Skills</h2>
          <p className="mode-select__card-description">
            Arithmetic, times tables, and number comparisons
          </p>
          <div className="mode-select__card-features">
            <span>➕ Arithmetic</span>
            <span>✖️ Times Tables</span>
            <span>⚖️ Comparisons</span>
          </div>
          <div className="mode-select__card-action">
            {modeStats['math-combined']?.gamesPlayed ? 'Continue Math →' : 'Start Math →'}
          </div>
        </button>

        <button
          className="mode-select__card mode-select__card--reading"
          onClick={() => onSelectMode('reading')}
        >
          {renderProgressBadge(modeStats.reading)}
          <div className="mode-select__card-icon">📖</div>
          <h2 className="mode-select__card-title">Reading Skills</h2>
          <p className="mode-select__card-description">
            Read words out loud to practice pronunciation
          </p>
          <div className="mode-select__card-features">
            <span>🗣️ Voice Practice</span>
            <span>📚 Sight Words</span>
            <span>🔊 Word Sounds</span>
          </div>
          <div className="mode-select__card-action">
            {modeStats.reading?.gamesPlayed ? 'Continue Reading →' : 'Start Reading →'}
          </div>
        </button>

        <button
          className="mode-select__card mode-select__card--geography"
          onClick={() => onSelectMode('geography')}
        >
          {renderProgressBadge(modeStats.geography)}
          <div className="mode-select__card-icon">🗺️</div>
          <h2 className="mode-select__card-title">Geography Skills</h2>
          <p className="mode-select__card-description">
            Learn countries, capitals, landmarks, and US states
          </p>
          <div className="mode-select__card-features">
            <span>🌍 World Map</span>
            <span>🏛️ Capitals</span>
            <span>🗽 Landmarks</span>
            <span>🇺🇸 US States</span>
          </div>
          <div className="mode-select__card-action">
            {modeStats.geography?.gamesPlayed ? 'Continue Geography →' : 'Start Geography →'}
          </div>
        </button>

        <button
          className="mode-select__card mode-select__card--charts"
          onClick={() => onSelectMode('charts')}
        >
          {renderProgressBadge(modeStats.charts)}
          <div className="mode-select__card-icon">📊</div>
          <h2 className="mode-select__card-title">Chart Skills</h2>
          <p className="mode-select__card-description">
            Learn to read bar charts, pie charts, line graphs, and more
          </p>
          <div className="mode-select__card-features">
            <span>📊 Bar Charts</span>
            <span>📈 Line Graphs</span>
            <span>🥧 Pie Charts</span>
            <span>🖼️ Pictographs</span>
          </div>
          <div className="mode-select__card-action">
            {modeStats.charts?.gamesPlayed ? 'Continue Charts →' : 'Start Charts →'}
          </div>
        </button>

        <button
          className="mode-select__card mode-select__card--arcade"
          onClick={() => onSelectMode('arcade')}
        >
          {renderProgressBadge(modeStats.arcade)}
          <div className="mode-select__card-icon">🎮</div>
          <h2 className="mode-select__card-title">Arcade Games</h2>
          <p className="mode-select__card-description">
            Action-packed learning games with speed challenges!
          </p>
          <div className="mode-select__card-features">
            <span>🚀 Math Blaster</span>
            <span>🥷 Number Ninja</span>
            <span>👾 Invaders</span>
            <span>🐍 Math Snake</span>
          </div>
          <div className="mode-select__card-action">
            {modeStats.arcade?.gamesPlayed ? 'Continue Arcade →' : 'Start Arcade →'}
          </div>
        </button>

        <button
          className="mode-select__card mode-select__card--algebra"
          onClick={() => onSelectMode('algebra')}
        >
          {renderProgressBadge(modeStats.algebra)}
          <div className="mode-select__card-icon">🔤</div>
          <h2 className="mode-select__card-title">Algebra Skills</h2>
          <p className="mode-select__card-description">
            Solve equations and learn algebraic thinking
          </p>
          <div className="mode-select__card-features">
            <span>📐 Equations</span>
            <span>❓ Variables</span>
            <span>⚖️ Balance</span>
            <span>🧮 Solve</span>
          </div>
          <div className="mode-select__card-action">
            {modeStats.algebra?.gamesPlayed ? 'Continue Algebra →' : 'Start Algebra →'}
          </div>
        </button>

        <button
          className="mode-select__card mode-select__card--wordProblems"
          onClick={() => onSelectMode('wordProblems')}
        >
          {renderProgressBadge(modeStats.wordProblems)}
          <div className="mode-select__card-icon">📝</div>
          <h2 className="mode-select__card-title">Word Problems</h2>
          <p className="mode-select__card-description">
            Read stories and solve real-world math problems
          </p>
          <div className="mode-select__card-features">
            <span>📖 Stories</span>
            <span>🛒 Shopping</span>
            <span>🍎 Sharing</span>
            <span>⏰ Time</span>
          </div>
          <div className="mode-select__card-action">
            {modeStats.wordProblems?.gamesPlayed ? 'Continue Problems →' : 'Start Problems →'}
          </div>
        </button>

      </div>

      <div className="mode-select__footer">
        <p>Practice makes perfect!</p>
      </div>
    </div>
  );
}
