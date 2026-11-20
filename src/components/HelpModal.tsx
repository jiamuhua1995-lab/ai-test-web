import { useEffect } from 'react';
import s from './HelpModal.module.css';
import ui from '../styles/ui.module.css';

interface HelpModalProps {
  onClose: () => void;
}

const KEYS: [string, string][] = [
  ['← →', '上一个 / 下一个用例'],
  ['1 2 3 4', '网格列数'],
  ['G S X', '网格 / 滑块 / 闪视视图'],
  ['A', '切换对齐方式（整图 ↔ 原图区域）'],
  ['F', '原图边界框开关'],
  ['空格', '闪视视图下按住查看 B'],
  ['+ − 0', '放大 / 缩小 / 复位'],
  ['滚轮 / 拖拽', '缩放 / 平移（所有图同步）'],
];

const STRUCTURE = `public/data/cases/
  001-人像左右扩/
    original.jpg      ← 原图，也认 原图 / input / src
    seedream.jpg      ← 文件名即模型名
    nano-banana.jpg
    qwen-image.jpg
  002-风景上下扩/
    ...`;

export function HelpModal({ onClose }: HelpModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={s.mask} onClick={onClose}>
      <div className={s.box} onClick={(e) => e.stopPropagation()}>
        <h2>用法 &amp; 快捷键</h2>

        <table className={s.table}>
          <tbody>
            {KEYS.map(([k, desc]) => (
              <tr key={k}>
                <td>
                  {k.split(' ').map((one) => (
                    <kbd key={one} style={{ marginRight: 4 }}>
                      {one}
                    </kbd>
                  ))}
                </td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>数据目录约定</h3>
        <pre className={s.pre}>{STRUCTURE}</pre>
        <p className={s.note}>
          放好图片后执行 <code>npm run manifest</code> 生成 <code>public/data/manifest.json</code>，
          再点「重载清单」。清单里可给每个结果写 <code>frame: [x, y, w, h]</code>（0~1 比例），
          标明原图在扩图结果中的位置；没写时按「原图像素居中粘贴」自动推算，
          可用左栏「原图占比修正」校正。
        </p>

        <h3>怎么看</h3>
        <p className={s.note}>
          先用<b>网格</b>扫一眼整体构图是否合理；切到<b>原图区域</b>对齐，确认扩图没有改动原图像素；
          再用<b>滑块</b>或<b>闪视</b>盯接缝处的纹理、光照连续性。边看边打分，右栏自动出排行。
        </p>

        <div className={s.footer}>
          <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={onClose}>
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
