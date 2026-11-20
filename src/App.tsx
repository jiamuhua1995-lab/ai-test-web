import { useState } from 'react';
import s from './App.module.css';
import { CaseList } from './components/CaseList';
import { DisplayPanel } from './components/DisplayPanel';
import { DropZone } from './components/DropZone';
import { HelpModal } from './components/HelpModal';
import { Leaderboard } from './components/Leaderboard';
import { ModelList } from './components/ModelList';
import { ScorePanel } from './components/ScorePanel';
import { StageArea } from './components/StageArea';
import { TopBar } from './components/TopBar';
import { useCompareState } from './hooks/useCompareState';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export function App() {
  const store = useCompareState();
  const [helpOpen, setHelpOpen] = useState(false);
  useKeyboardShortcuts(store, { enabled: !helpOpen });

  return (
    <div className={s.app}>
      <TopBar store={store} onHelp={() => setHelpOpen(true)} />

      <div className={s.layout}>
        <aside className={s.sidebar}>
          <CaseList store={store} />
          <ModelList store={store} />
          <DisplayPanel store={store} />
        </aside>

        <StageArea store={store} />

        <aside className={s.rightbar}>
          <ScorePanel store={store} />
          <Leaderboard store={store} />
        </aside>
      </div>

      <DropZone onFiles={store.importFiles} />
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
