/// <reference types="vite/client" />

declare module 'jszip' {
  export default class JSZip {
    loadAsync(data: any, options?: any): Promise<JSZip>;
    file(name: string): any;
    [key: string]: any;
  }
}

