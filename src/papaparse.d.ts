declare module 'papaparse' {
    export function parse(
      input: File | string,
      config?: {
        header?: boolean;
        skipEmptyLines?: boolean;
        complete?: (results: any) => void;
        error?: (error: any) => void;
        // add more options if needed
      }
    ): void;
  
    export interface ParseResult<T> {
      data: T[];
      errors: any[];
      meta: any;
    }
  }
  