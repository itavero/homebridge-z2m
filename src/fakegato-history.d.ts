declare module 'fakegato-history' {
  interface FakeGatoHistoryServiceOptions {
    size?: number;
    disableTimer?: boolean;
    disableRepeatLastData?: boolean;
    storage?: string;
    path?: string;
  }

  interface FakeGatoHistoryEntry {
    time: number;
    [key: string]: number | boolean;
  }

  interface FakeGatoHistoryService {
    addEntry(entry: FakeGatoHistoryEntry): void;
    readonly UUID: string;
    readonly subtype: string | undefined;
    readonly displayName: string;
  }

  interface FakeGatoHistoryServiceConstructor {
    new (
      accessoryType: string,
      accessory: { log: object; displayName: string },
      options?: FakeGatoHistoryServiceOptions | number
    ): FakeGatoHistoryService;
  }

  function init(api: object): FakeGatoHistoryServiceConstructor;
  export = init;
}
