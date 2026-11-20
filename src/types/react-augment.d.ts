import 'react';

// 目录选择是非标准属性，补上类型声明
declare module 'react' {
  interface InputHTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}
