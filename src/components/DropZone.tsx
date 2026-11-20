import { useEffect, useState } from 'react';
import s from './DropZone.module.css';
import { filesFromDataTransfer } from '../utils/folderImport';

interface DropZoneProps {
  onFiles: (files: File[]) => Promise<void>;
}

/** 整个窗口都能接拖拽，支持整个文件夹 */
export function DropZone({ onFiles }: DropZoneProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let depth = 0;

    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      depth += 1;
      setActive(true);
    };

    const onOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
    };

    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    };

    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      depth = 0;
      setActive(false);
      void filesFromDataTransfer(e.dataTransfer).then((files) => {
        if (files.length) void onFiles(files);
      });
    };

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [onFiles]);

  if (!active) return null;

  return (
    <div className={s.mask}>
      <div className={s.hint}>
        松手即导入
        <small>目录结构：用例名 / original.jpg + 模型名.jpg</small>
      </div>
    </div>
  );
}
