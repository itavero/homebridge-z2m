export class ExtendedTimer {
   private interval: number;
   private timeout: NodeJS.Timeout | undefined;
   constructor(private readonly callback: () => void, interval = 1000) {
     this.interval = interval;
     this.timeout = undefined;
   }

   get isActive() : boolean {
     return this.timeout !== undefined;
   }

   changeInterval(newInterval: number) {
     this.interval = newInterval;
     if (this.isActive) {
       this.restart();
     }
   }

   start(): void {
     if (!this.isActive) {
       this.timeout = setInterval(this.callback, this.interval);
     }
   }

   restart(): void {
     this.stop();
     this.start();
   }

   stop(): void {
     if (this.isActive) {
       clearInterval(this.timeout as NodeJS.Timeout);
       this.timeout = undefined;
     }
   }
}