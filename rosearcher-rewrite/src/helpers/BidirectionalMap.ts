export default class BidirectionalMap<K, V> extends Map<K, V> {
    reverseMap: Map<V, K[]>;

    constructor() {
        super();
        this.reverseMap = new Map<V, K[]>();
    }

    set(key: K, value: V | V[]): this {
        if (Array.isArray(value)) {
            value.forEach((v) => {
                super.set(key, v);
                this.updateReverseMap(v, key);
            });
        } else {
            super.set(key, value);
            this.updateReverseMap(value, key);
        }
        return this;
    }

    private updateReverseMap(value: V, key: K) {
        let reverseValue = this.reverseMap.get(value);
        if (!reverseValue) {
            reverseValue = [];
            this.reverseMap.set(value, reverseValue);
        }
        if (!reverseValue.includes(key)) {
            reverseValue.push(key);
        }
    }

    delete(key: K): boolean {
        const value = super.get(key);
        if (value !== undefined) {
            super.delete(key);
            const keys = this.reverseMap.get(value);
            if (keys) {
                const index = keys.indexOf(key);
                if (index !== -1) {
                    keys.splice(index, 1);
                }
                if (keys.length === 0) {
                    this.reverseMap.delete(value);
                }
                return true;
            }
        }
        return false;
    }

    clear(): void {
        super.clear();
        this.reverseMap.clear();
    }

    getReverse(value: V): K[] {
        return this.reverseMap.get(value) || [];
    }

    hasReverse(value: V): boolean {
        return this.reverseMap.has(value);
    }
}
