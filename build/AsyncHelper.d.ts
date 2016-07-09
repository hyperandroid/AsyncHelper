export declare type SignalObserver = (...args: any[]) => void;
export declare class Signal {
    _observers: SignalObserver[];
    _observersOnce: SignalObserver[];
    constructor();
    on(observer: SignalObserver): this;
    addListener(f: SignalObserver): this;
    addListenerInFrontOfList(f: SignalObserver): this;
    removeListener(f: SignalObserver): this;
    removeAllListeners(): this;
    addListenerOnce(f: SignalObserver): this;
    emit(...__arguments: any[]): void;
}
export declare enum BOOL_OPERATOR {
    NOT_SET = -1,
    TRUE = 1,
    FALSE = 0,
}
export declare class Condition {
    _signalConditionStateChange: Signal;
    _signalTimeout: Signal;
    _b_condition: BOOL_OPERATOR;
    _id: string;
    _timerId: number;
    constructor();
    id: string;
    setId(id: string): this;
    __emit(): void;
    setTrue(): this;
    setFalse(): this;
    isTrue(): boolean;
    isFalse(): boolean;
    isNotSet(): boolean;
    onStateChange(callback: SignalObserver): this;
    onTrue(callback: SignalObserver): this;
    onFalse(callback: SignalObserver): this;
    setTimeout(timeout: number): this;
    __cancelTimer(): void;
    __timeout(): void;
    onTimeout(f: SignalObserver): this;
    disable(): void;
    getCurrentValue(): BOOL_OPERATOR;
    then(success: SignalObserver, error?: SignalObserver): void;
    reset(): this;
    setNotSet(): this;
}
export declare enum BOOLEAN_OPERATOR {
    AND = 0,
    OR = 1,
}
export declare class ConditionTree extends Condition {
    _booleanOperator: BOOLEAN_OPERATOR;
    _children: Condition[];
    constructor(operator?: BOOLEAN_OPERATOR);
    __isTrueOr(): BOOL_OPERATOR;
    __isTrueAnd(): BOOL_OPERATOR;
    __isTrue(): BOOL_OPERATOR;
    addCondition(condition: Condition): this;
    __conditionChanged(): void;
}
export declare class ParallelConditionDescriptor {
    _condition: Condition;
    _fn: ParallelConditionElementFunction;
    constructor(fn: ParallelConditionElementFunction, condition: Condition);
}
export declare type ParallelConditionElementFunction = (c: Condition, index: number) => void;
export declare type ParallelConditionElement = ParallelConditionElementFunction | ParallelCondition;
export declare class ParallelCondition extends ConditionTree {
    _iterableArray: ParallelConditionDescriptor[];
    _timeout: number;
    constructor(array: ParallelConditionElement[], timeout?: number);
    __setIterableArray(array: ParallelConditionElement[]): void;
    execute(): void;
}
export declare type FutureCallback<T> = (f: Future<T | Error>) => void;
export declare class Future<T> {
    _value: T;
    _valueSetCondition: Condition;
    constructor();
    getValue(): T;
    isValueSet(): boolean;
    setValue(v: any): void;
    onValueSet(callback: FutureCallback<T>): this;
    then(success: (result: T | Error) => void, error: (err: Error) => void): void;
    node(callback: (err: Error, retValue?: T) => void): void;
}
export declare class WorkerTask {
    _timeout: number;
    _future: Future<any>;
    _task: FutureCallback<any>;
    constructor(task: FutureCallback<any>, timeout: number);
    getTask(): (f: Future<any>) => void;
    getTimeout(): number;
    getFuture(): Future<any>;
}
export declare type WorkerCallback = (c: Condition) => void;
export declare class Worker {
    _id: string;
    _workingCondition: Condition;
    _timeoutCondition: Condition;
    _currentWorkerTask: WorkerTask;
    constructor(name_prefix: string);
    run(workerTask: WorkerTask): void;
    isWorking(): boolean;
    isTimedOut(): boolean;
    onWorkDone(f: WorkerCallback): this;
    onTimeout(f: WorkerCallback): this;
    kill(): void;
}
export declare type GenericFunction = (...args: any[]) => any;
export declare type FutureFunction<T> = (f: Future<T>) => any;
export declare type DispatcherCallback = (d: Dispatcher) => void;
export declare class Dispatcher {
    _concurrency: number;
    _workers: Worker[];
    _pendingTasks: WorkerTask[];
    _isEmptySignal: Signal;
    _stallingSignal: Signal;
    _workerPrefix: string;
    constructor(concurrency: number, prefix?: string);
    onEmpty(f: SignalObserver): void;
    onStall(f: SignalObserver): void;
    getPendingTasksLength(): number;
    submit<T>(_task: FutureFunction<T>, _timeout: number): Future<T | Error>;
    waterfall<T>(__task: GenericFunction | GenericFunction[], _timeout: number, haltOnError?: boolean): Future<T | Error>;
    submitNodeSequence<T>(__task: GenericFunction | GenericFunction[], _timeout?: number, haltOnError?: boolean): Future<T | Error>;
    submitCondition(_condition: ParallelCondition, _timeout: number): Future<{} | Error>;
    addIsEmptyListener(l: DispatcherCallback): this;
    __executeTask(): void;
    __workerNotBusy(worker: Worker): void;
    __workerTimedOut(worker: Worker): void;
}
