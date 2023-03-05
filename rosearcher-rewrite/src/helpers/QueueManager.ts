export default class QueueManager {
    queue: string[] = [];

    addToQueue = (item: string) => {
        if (this.queue.includes(item))
            return;
        this.queue.push(item);
    };

    addToQueueFront = (item: string) => {
        if (this.queue.includes(item))
            return;
        this.queue.unshift(item);
    };

    fetchFromQueue = () => this.queue.shift();

    removeFetchAmount = (amount: number) => this.queue.splice(0, amount);

    appendTable = (table: Array<string>) => {
        this.queue = this.queue.concat(table);
    };

    clearQueue = () => {
        this.queue = [];
    };

    length = () => this.queue.length;

    has = (item: string) => this.queue.includes(item);
}
