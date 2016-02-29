/**
 * (c) 2013-2016 Ibon Tolosana.
 */


/**
 * Untangle: untangle the callback nightmare with stateful objects and asynchronous functionality.
 * Objects available:
 *
 *  Signal
 *  Condition
 *  ConditionTree
 *  ParallelCondition
 *  Future
 *  WorkerTask
 *  Worker
 *  Dispatcher
 *
 * @see license.txt file
 *
 */


    /**
     * Schedule a task in the future.
     * @param f {function()}
     * @param delay {number=} milliseconds to schedule in the future
     */
    function schedule(f:()=>void, delay?:number) {
        if (!delay) {
            setImmediate(f);
        } else {
            setTimeout(f, delay || 0);
        }
    }

    /**
     * ForEach parallel.
     * Schedule each of the Array elements in the future.
     * Do not use directly, it is used internally by the library.
     */
    function forEachP(arr:ParallelConditionDescriptor[]) {
        arr.forEach(function (i:any) {
            schedule(
                (function (elem:ParallelConditionDescriptor, index:number/*,array*/) {
                    return function () {
                        elem._fn(elem._condition, index);
                    }
                })(arr[i], i),
                0
            );
        });
    }


    export type SignalObserver = (...args:any[])=>void;

    /**
     * Signal is a string-based observer substitution. Instead of registering events by (commonly) string,
     * the signal gives context to the event by creating an object which takes care of notifying its observers.
     * It also takes care of all the burden of managing observers, registering, notifying, etc.
     *
     * It allows to registers single and multi shot observers.
     *
     * The signal is agnostic regarding what content will notify to its observers.
     *
     * Every time the signal emits (notifies observers) the <code>observersOnce</code> collection will be reset.
     *
     * @return {*}
     * @constructor
     */
    export class Signal {

        _observers:SignalObserver[];
        _observersOnce:SignalObserver[];

        constructor() {
            this._observers = [];
            this._observersOnce = [];
        }

        on(observer:SignalObserver) {
            return this.addListener(observer);
        }

        /**
         * Add a multishot observer.
         * @param f {function(*)} a callback function with variable parameters.
         * @return {*}
         */
        addListener(f:SignalObserver) {
            this._observers.push(f);
            return this;
        }

        /**
         * Add a multi shot observer as the first one in the list.
         * @param f {function(*)} a callback function with variable parameters.
         * @return {*}
         */
        addListenerInFrontOfList(f:SignalObserver) {
            this._observers.unshift(f);
            return this;
        }

        /**
         * Remove a multishot observer.
         * @param f {function(*)} a previously registered observer by a call to addLitener.
         * @return {*}
         */
        removeListener(f:SignalObserver) {
            let index = this._observers.indexOf(f);
            if (-1 !== index) {
                this._observers.splice(index, 1);
            }
            return this;
        }

        /**
         * Remove all multishot observers.
         * @return {*}
         */
        removeAllListeners() {
            this._observers = [];
            this._observersOnce = [];
            return this;
        }

        /**
         * Add a one shot observer.
         * The callback function will only be called once.
         * @param f {function()}
         */
        addListenerOnce(f:SignalObserver) {
            this._observersOnce.push(f);
            return this;
        }

        /**
         * Notify all observers, either single/multi shot.
         */
        emit(...__arguments:any[]) {

            this._observers.forEach(function (e) {
                e.apply(e, Array.prototype.slice.call(__arguments));
            });
            this._observersOnce.forEach(function (e) {
                e.apply(e, Array.prototype.slice.call(__arguments));
            });

            this._observersOnce = [];
        }
    }

    /**
     * @enum Condition possible values.
     */
    export enum BOOL_OPERATOR {
        NOT_SET = -1,
        TRUE = 1,
        FALSE = 0
    }


    var __conditionIndex = 0;
    /**
     * Condition is a wrapper for a tri-state condition.
     *
     * The need for a Condition object is that of statefulness. In certain situations, you want to know
     * whether certain condition has happened in time, and whether it was true or false.
     *
     * A condition will only notify once when its value is set. It will never notify again after set, and can't
     * have its internal condition value changed.
     *
     * Whenever the Condition changes state, it will notify any registered observers. To do so, the Condition
     * holds a Signal object.
     *
     * Conditions can have associated a timeout. If the timer expires, the Condition is automatically set to
     * false by calling <code>setFalse()</code>.
     *
     * You can wait for value changes on a condition by calling
     * <li><code>onTrue(callback)</code>
     * <li><code>onFalse(callback)</code>
     * <li><code>onChange(callback)</code>
     *
     * in all three cases, the callback function will receive the Condition as parameter.
     *
     * A condition usage use case:
     *
     * var c= new Condition().onTrue( function(condition) {
 *     // do something here when the condition is met
 *     } );
     *
     * later in the code:
     *
     * c.setTrue();
     *
     * This is no different than setting a callback, but at any given moment, you can ask if the condition has
     * ever had value:
     *
     * c.isNotSet()
     *
     * and if it has ever met, whether it was true or false:
     *
     * c.isTrue() or c.isFalse().
     *
     * @return {*}
     * @constructor
     */
    export class Condition {

        /**
         * Signal to emit state change events {Signal}
         * @type {Signal}
         * @private
         */
        _signalConditionStateChange:Signal;

        /**
         * Signal to emit condition timed out.
         * @type {Signal}
         */
        _signalTimeout:Signal;

        /**
         * internal state value {Condition}
         * @type {BOOL_OPERATOR}
         * @private
         */
        _b_condition:BOOL_OPERATOR;

        /**
         * Arbitrary id.
         * @type {*}
         */
        _id:string;

        _timerId:number;

        constructor() {
            this._signalConditionStateChange = new Signal();
            this._signalTimeout = new Signal();
            this._b_condition = BOOL_OPERATOR.NOT_SET;
            this._id = 'Condition' + __conditionIndex++;
            this._timerId = null;
        }

        get id() {
            return this._id;
        }

        set id(id:string) {
            this._id = id;
        }

        /**
         * Emit condition state change events.
         * @private
         */
        __emit() {
            this._signalConditionStateChange.emit(this);
        }

        /**
         * Set a condition as true.
         * If the condition was true, nothing happens.
         * Otherwise, the internal status will be <code>BOOL_OPERATOR.TRUE</code>.
         * Observers of this condition will be notified of the state change.
         * @return {*}
         */
        setTrue() {

            if ( this._b_condition===BOOL_OPERATOR.TRUE ) {
                return this;
            }

            this.__cancelTimer();
            this._b_condition = BOOL_OPERATOR.TRUE;
            this.__emit();

            return this;
        }

        /**
         * Set a condition as true.
         * If the condition was false, nothing happens.
         * Otherwise, the internal status will be a value from <code>BOOL_OPERATOR.FALSE</code>.
         * Observers of this condition will be notified of the state change.
         * @return {*}
         */
        setFalse() {
            if ( this._b_condition===BOOL_OPERATOR.FALSE ) {
                return this;
            }

            this.__cancelTimer();
            this._b_condition = BOOL_OPERATOR.FALSE;
            this.__emit();

            return this;
        }

        /**
         * Test this condition for BOOL_OPERATOR.TRUE
         * @return {Boolean}
         */
        isTrue() {
            return this._b_condition === BOOL_OPERATOR.TRUE;
        }

        /**
         * Test this condition for BOOL_OPERATOR.FALSE
         * @return {Boolean}
         */
        isFalse() {
            return this._b_condition === BOOL_OPERATOR.FALSE;
        }

        /**
         * Test this condition for BOOL_OPERATOR.NOT_SET
         * @return {Boolean}
         */
        isNotSet() {
            return this._b_condition === BOOL_OPERATOR.NOT_SET;
        }

        /**
         * Register a callback function to be notified whenever the Condition changes state.
         * @param callback {SignalObserver} a callback function to notify upon Condition state changes.
         * @return {Condition}
         */
        onStateChange(callback:SignalObserver) {
            this._signalConditionStateChange.addListener(callback);
            return this;
        }

        /**
         * Register a callback function to be notified whenever the Condition gets BOOL_OPERATOR.TRUE.
         * @param callback {SignalObserver} a callback function to notify upon Condition state changes.
         * @return {Condition}
         */
        onTrue(callback:SignalObserver) {
            if (this.isTrue()) {
                schedule(function () {
                    callback(this);
                }, 0);
            } else {
                (function (me:Condition, callback:SignalObserver) {
                    me._signalConditionStateChange.addListener(function (condition) {
                        if (condition.isTrue()) {
                            callback(me);
                        }
                    });
                })(this, callback);
            }

            return this;
        }

        /**
         * Register a callback function to be notified whenever the Condition gets BOOL_OPERATOR.FALSE.
         * @param callback {SignalObserver} a callback function to notify upon Condition state changes.
         * @return {Condition}
         */
        onFalse(callback:SignalObserver) {
            if (this.isFalse()) {
                schedule(function () {
                    callback(this);
                }, 0);
            } else {
                (function (me:Condition, callback:SignalObserver) {
                    me._signalConditionStateChange.addListener(function (condition) {
                        if (condition.isFalse()) {
                            callback(me);
                        }
                    });
                })(this, callback);
            }

            return this;
        }

        /**
         * Set this condition timeout.
         * When the timeout expires, <code>setFalse</code> is called in the condition.
         * @param timeout
         * @return {*}
         */
        setTimeout(timeout:number) {
            this._timerId = setTimeout(this.__timeout.bind(this), timeout);
            return this;
        }

        /**
         * Cancel this Condition internal timeout.
         * @private
         */
        __cancelTimer() {
            if (this._timerId) {
                clearTimeout(this._timerId);
                this._timerId = null;
            }
        }

        /**
         * This function is invoked when the Condition is timed out.
         * @private
         */
        __timeout() {
            this.setFalse();
            this._timerId = null;
            this._signalTimeout.emit(this);
        }

        /**
         * Register an observer callback function for timeout events.
         * @param f
         * @return {*}
         */
        onTimeout(f:SignalObserver) {
            this._signalTimeout.addListener(f);
            return this;
        }

        /**
         * Disable this condition by removing all registered listeners.
         */
        disable() {
            this._signalConditionStateChange.removeAllListeners();
            this._signalTimeout.removeAllListeners();
        }

        /**
         * Return this Condition's internal value.
         * @return {*}
         */
        getCurrentValue() {
            return this._b_condition;
        }

        then(success:SignalObserver, error?:SignalObserver) {
            this.onTrue(success);
            if (error) {
                this.onFalse(error);
            }
        }

        reset() {
            this.setNotSet();
            return this;
        }

        setNotSet() {
            var prev= this._b_condition;
            this._b_condition = BOOL_OPERATOR.NOT_SET;
            if ( prev!==BOOL_OPERATOR.NOT_SET ) {
                this.__emit();
            }
            return this;
        }
    }

    export enum BOOLEAN_OPERATOR {
        AND = 0,
        OR = 1
    }

    /**
     * ConditionTree is the extension of a simple Condition into a full fledged boolean condition tree.
     * A ConditionTree can contain other trees as conditions to form structures like:
     *   A or (B and (C or D))
     *
     * All the base behavior of a simple Condition can be applied to ConditionTree objects.
     *
     * A condition tree applies fast condition short circuit, notifying as soon as possible about condition
     * state changed.
     *
     * @return {*}
     * @constructor
     */
    export class ConditionTree extends Condition {


        _booleanOperator:BOOLEAN_OPERATOR;
        _children:Condition[];

        constructor() {
            super();
            this._booleanOperator = BOOLEAN_OPERATOR.AND;
            this._children = [];
        }

        /**
         * Set the boolean operator that will be applied to this tree's children.
         * @param op
         * @return {*}
         */
        setBooleanOperator(op:BOOLEAN_OPERATOR) {
            this._booleanOperator = op;
            return this;
        }

        /**
         * Find this tree's boolean value making a logical OR with its children.
         * @return {BOOL_OPERATOR}
         * @private
         */
        __isTrueOr():BOOL_OPERATOR {
            let i:number;
            let notSet = false;

            for (i = 0; i < this._children.length; i++) {
                if (this._children[i].isTrue()) {
                    return BOOL_OPERATOR.TRUE;
                } else if (this._children[i].isNotSet()) {
                    notSet = true;
                }
            }

            return notSet ? BOOL_OPERATOR.NOT_SET : BOOL_OPERATOR.FALSE;
        }

        /**
         * Find this tree's boolen value making a logical AND with its children.
         * @return {(BOOL_OPERATOR)}
         * @private
         */
        __isTrueAnd():BOOL_OPERATOR {
            let notSet = false;

            for (let i = 0; i < this._children.length; i++) {
                if (this._children[i].isFalse()) {
                    return BOOL_OPERATOR.FALSE;
                } else if (this._children[i].isNotSet()) {
                    notSet = true;
                }
            }

            return notSet ? BOOL_OPERATOR.NOT_SET : BOOL_OPERATOR.TRUE;
        }

        /**
         * @return {BOOL_OPERATOR}
         * @private
         */
        __isTrue() {
            let value:BOOL_OPERATOR;

            value = ( this._booleanOperator === BOOLEAN_OPERATOR.AND ) ?
                this.__isTrueAnd() :
                this.__isTrueOr();

            return value;
        }

        /**
         * Add a new Condition to this ConditionTree.
         * @param condition {Condition | ConditionTree}
         */
        addCondition(condition:Condition) {
            this._children.push(condition);
            condition.onStateChange(this.__conditionChanged.bind(this));
            return this;
        }

        /**
         * Invoked when a condition in this tree changes value.
         * @private
         */
        __conditionChanged() {
            if (this.isNotSet()) {
                switch (this.__isTrue()) {
                    case BOOL_OPERATOR.NOT_SET:
                        break;
                    case BOOL_OPERATOR.TRUE:
                        this.setTrue();
                        break;
                    case BOOL_OPERATOR.FALSE:
                        this.setFalse();
                        break;
                }
            }
        }
    }

    export class ParallelConditionDescriptor {
        _condition:Condition;
        _fn:ParallelConditionElementFunction;

        constructor(fn:ParallelConditionElementFunction, condition:Condition) {
            this._condition = condition;
            this._fn = fn;
        }
    }

    export type ParallelConditionElementFunction = (c:Condition, index:number)=>void;
    export type ParallelConditionElement = ParallelConditionElementFunction | ParallelCondition;

    /**
     *
     * A parallel condition object defines a ConditionTree where each condition is associated with an asynchronous
     * executing function.
     * It expects a list of functions or other ParallelCondition objects to be asynchronously executed.
     * As a ConditionTree, it will short circuit the condition fast to allow your main execution line progress as
     * soon as possible.
     *
     * It inherits all the behavior from ConditionTree and hence from Condition.
     *
     * @param array Array.<{ ( function( Condition, number ) | ParallelCondition) } > array of functions that accept a
     *  Condition and a number (index sequence of paralleled functions).
     * @param timeout {number} millisecond to have the task completed
     */
    export class ParallelCondition extends ConditionTree {

        _iterableArray:ParallelConditionDescriptor[];
        _timeout:number;

        constructor(array:ParallelConditionElement[], timeout?:number) {
            super();
            this.__setIterableArray(array);
            this._timeout = timeout || 0;
        }

        /**
         * Set the internal ConditionTree object.
         * @param array {Array< SignalObserver | ParallelCondition >}
         * @private
         */
        __setIterableArray(array:ParallelConditionElement[]) {

            const me = this;
            const iterableArray:ParallelConditionDescriptor[] = [];

            if (array.constructor !== Array) {
                throw "ParallelCondition needs an Array of functions or other ParallelConditions.";
            }

            array.forEach(function (element:ParallelConditionElement) {

                var condition:Condition;

                if (typeof element === "function") {
                    condition = new Condition();
                    me.addCondition(condition);
                    iterableArray.push(new ParallelConditionDescriptor(<ParallelConditionElementFunction>element, condition));

                } else if (element instanceof ParallelCondition) {
                    condition = element;
                    me.addCondition(condition);
                    iterableArray.push(new ParallelConditionDescriptor(
                        function () {
                            (<ParallelCondition>element).execute();
                        },
                        condition
                    ));

                } else {
                    throw new Error("ParallelCondition needs functions or other ParallelCondition as parameters.");
                }
            });

            this._iterableArray = iterableArray;
        }

        /**
         * Start the asynchronous condition evaluation.
         * This function will notify any registered observer via:
         *
         * <code>onTrue</code>
         * <code>onFalse</code>
         * <code>onStateChange</code>
         * <code>onTimeout</code>
         */
        execute() {

            if (this._timeout > 0) {
                this.setTimeout(this._timeout);
            }

            // element is supposed to be a function that receives as parameters:
            // + Condition object
            // + Number as the index sequence of the paralleled functions
            forEachP(this._iterableArray);
        }

    }

    export type FutureCallback = (f:Future) => void;

    /**
     * Future objects are holders for values of functions not yet executed.
     * Futures have stateful semantics and their values can be set only once.
     *
     * Futures expect value observers to register via a call to <code>onValueSet</code>.
     *
     * If you want to test for a valid value in the Future object, a call to <code>isValueSet</code> must
     * be performed to know whether a value has been set, followed by a call to <code>getValue</code> which
     * will return the actual value set in this Future object.
     *
     * @return {*}
     * @constructor
     */
    export class Future {

        _value:any;
        _valueSetCondition:Condition;

        constructor() {
            this._value = null;
            this._valueSetCondition = new Condition();
        }

        /**
         * Return this Future object's value.
         * If calling this method, a call to <code>isValueSet</code> must be performed to know whether the Future
         * has had a value set.
         *
         * @return {*}
         */
        getValue() {
            return this._value;
        }

        /**
         * Test internal Condition object to know whether a value has been set in the Future object.
         * @return {Boolean}
         */
        isValueSet() {
            return this._valueSetCondition.isTrue();
        }

        /**
         * Set this Future object's value and notify any registered observers.
         * @param v {Object}
         */
        setValue(v:any) {
            if (!this._valueSetCondition.isTrue()) {
                this._value = v;
                this._valueSetCondition.setTrue();
            }
        }

        /**
         * Register a callback function as observer for this Future object's set value event.
         * @param callback {FutureCallback}
         * @return {*}
         */
        onValueSet(callback:FutureCallback) {

            const me = this;

            if (this._valueSetCondition.isTrue()) {
                schedule(function () {
                    callback(me);
                });
            }

            this._valueSetCondition.onTrue(callback.bind(null, this));
            return this;
        }

        then(callback:FutureCallback) {
            return this.onValueSet(callback);
        }
    }

    /**
     * This class is for internal use of a Dispatcher/Pool object.
     *
     * The task object is expected to be a function receiving a <code>Future</code> object,
     * but it may be a closure which behaves distinctly depending on the function called in the
     * <code>Dispatcher</code> object.
     *
     * A chained call, may be interrupted by external events:
     *
     * + if a timeout event is generated, the function execution will stop and the WorkerTask disabled (no condition
     *   or callback notification). The worker will be killed, and a new one will be created.
     * + if one function in the chain sets the Future's parameter to an Error instance, the chain call will stop
     *   and the worker will be reused.
     *
     *
     * @param task {FutureCallback}
     * @param timeout {number}
     * @return {*}
     * @constructor
     */
    export class WorkerTask {

        _timeout:number;
        _future:Future;
        _task:FutureCallback;

        constructor(task:FutureCallback, timeout:number) {
            this._timeout = timeout;
            this._future = new Future();
            this._task = task;
        }

        getTask() {
            return this._task;
        }

        getTimeout() {
            return this._timeout;
        }

        getFuture() {
            return this._future;
        }
    }

    let __workerIndex = 0;

    export type WorkerCallback = (c:Condition) => void;

    /**
     * A Worker is the heart of Dispatcher and Pool objects.
     * It keeps all the logic needed to execute asynchronous tasks, timeout them, and all the mechanics for
     * notifying about its internal activity:
     *
     * <li>is busy executing an asynchronous function
     * <li>is timed out. Timeout is just a notification, since the running asynchronous function can't be cancelled.
     *
     * @return {*}
     * @constructor
     */
    export class Worker {

        _id:string;
        _workingCondition:Condition;
        _timeoutCondition:Condition;
        _currentWorkerTask:WorkerTask;

        constructor() {
            this._id = "worker" + __workerIndex++;
            this._workingCondition = new Condition();
            this._timeoutCondition = new Condition();
            this._currentWorkerTask = null;
        }

        run(workerTask:WorkerTask) {

            const future = workerTask.getFuture();

            this._currentWorkerTask = workerTask;
            this._workingCondition.setTrue();

            // schedule
            (function (me:Worker, future:Future, timeout:number) {

                var timeoutId:number = null;

                setTimeout(function () {
                    // cambia la condicion de working cuando se establece valor al Future
                    future.onValueSet(function () {
                        me._workingCondition.setFalse();
                        if (timeoutId) {
                            clearTimeout(timeoutId);
                            timeoutId = null;
                        }
                    });

                    workerTask.getTask()(future);

                }, 0);

                if (timeout) {
                    timeoutId = setTimeout(function () {
                        me._timeoutCondition.setTrue();
                        timeoutId = null;
                    }, timeout);
                }

            })(this, future, workerTask.getTimeout());

        }

        /**
         *
         * @return {Boolean} is this Worker executing an asynchronous function ?
         */
        isWorking() {
            return this._workingCondition.isTrue();
        }

        /**
         *
         * @return {Boolean} is this worker is timed out ?
         */
        isTimedOut() {
            return this._timeoutCondition.isTrue();
        }

        /**
         * Register an observer for worker-ends-execution event.
         * @param f {function( Condition )} a callback function which will be notified when the worker ends.
         * @return {*}
         */
        onWorkDone(f:WorkerCallback) {
            this._workingCondition.onFalse(f);
            return this;
        }

        /**
         * Register an observer for worker-times-out event.
         * @param f {function( Condition ) } a callback function which will be notified when the worker ends.
         * @return {*}
         */
        onTimeout(f:WorkerCallback) {
            this._timeoutCondition.onTrue(f);
            return this;
        }

        /**
         * When the worker times out, a Dispatcher or Pool will mark a worker as invalid, and then Kill it,
         * preventing from notifying results from the asynchronous function is being performed.
         * @protected
         */
        kill() {
            console.warn(`Worker '${this._id}' timeout. Future value as Error.`);
            this._currentWorkerTask.getFuture().setValue(new Error("Worker '" + this._id + "' Timeout"));
            this._workingCondition.disable();
            this._timeoutCondition.disable();
        }
    }


    /**
     * Create the number of workers specified in the constructor.
     * Only called from the constructor.
     *
     * @private
     */
    function __createWorkers(dispatcher:Dispatcher, concurrency:number) {
        const workers:Worker[] = [];
        for (let i = 0; i < concurrency; i++) {
            var worker:Worker = __createWorker(dispatcher);
            workers.push(worker);
        }

        return workers;
    }

    /**
     * Helper to create
     * @return {Worker}
     * @private
     */
    function __createWorker(dispatcher:Dispatcher):Worker {
        var worker = new Worker();
        worker.onWorkDone(dispatcher.__workerNotBusy.bind(dispatcher, worker));
        worker.onTimeout(dispatcher.__workerTimedOut.bind(dispatcher, worker));

        return worker;
    }

    type GenericFunction = (...args:any[])=>any;
    type DispatcherCallback = (d:Dispatcher)=>void;

    interface AuditArgument {
        args : any[];
        ret : any;
    }

    /**
     * A Dispatcher object sequences the execution of tasks. Internally allocates a predefined number of
     * Worker instances to handle the submitted asynchronous tasks.
     * Each task can be submitted with its own timeout control.
     *
     * The Dispatcher will handle a list of submitted tasks and the specified number of Worker objects
     * in an attempt to sequentially execute tasks.
     * If more than one worker is specified in the constructor, there's no sequential execution guarantee
     * since the workers will have allocated tasks on demand.
     *
     * When one worker expires, the Dispatcher simply creates a new one and kills expired Workers's observers.
     *
     * @param concurrency {number} of active Worker objects. Defaults to 1.
     * @return {*}
     * @constructor
     */
    export class Dispatcher {

        _concurrency:number;
        _workers:Worker[];
        _pendingTasks:WorkerTask[];
        _isEmptySignal:Signal;

        constructor(concurrency:number) {

            this._concurrency = concurrency || 1;
            this._workers = __createWorkers(this, this._concurrency);
            this._pendingTasks = [];
            this._isEmptySignal = new Signal();
        }


        /**
         * Submit a task for asynchronous execution.
         *
         * @param _task { GenericFunction }
         * @param _timeout {number=} millisecond to consider this task timed out.
         * @return {Future}
         */
        submit(_task:GenericFunction, _timeout:number):Future {

            var task = new WorkerTask(_task, _timeout);
            this._pendingTasks.push(task);
            this.__executeTask();

            return task.getFuture();
        }

        submitNodeSequence(__task:GenericFunction | GenericFunction[], _timeout:number, haltOnError?:boolean):Future {

            if (typeof haltOnError === 'undefined') {
                haltOnError = true;
            }

            var task:GenericFunction;

            if (Object.prototype.toString.call(__task) === '[object Array]') {

                var _task = <FutureCallback[]>__task;

                // trivial.
                // an empty array has been set.
                if (_task.length === 0) {
                    task = function (future) {
                        future.setValue(true);
                    }
                } else {

                    task = function (future) {

                        const pendingTasks = Array.prototype.slice.call(_task);
                        let fnIndex:number = 0;
                        const auditArguments:AuditArgument[] = [];

                        function iterate(...args:any[]) {

                            const fn = pendingTasks.shift();
                            let retValue:any;

                            fnIndex += 1;

                            var auditArgument:AuditArgument = {
                                args: Array.prototype.slice.call(arguments),
                                ret: undefined
                            };
                            auditArguments.push(auditArgument);

                            try {
                                retValue = fn.apply(iterate, arguments);
                                if (retValue && pendingTasks.length) {
                                    iterate(undefined, retValue);
                                }

                                auditArgument.ret = retValue;

                                if (pendingTasks.length === 0) {
                                    future.setValue(retValue);
                                }
                            } catch (e) {

                                auditArgument.ret = e;

                                if (haltOnError) {
                                    var error = new Error(e);
                                    (<any>error).sequenceStacktrace = __getSequenceStackTrace(_task, auditArguments, fnIndex);
                                    future.setValue(error);
                                } else {
                                    iterate(e);
                                }
                            }

                        }

                        iterate();

                    }
                }
            } else {
                task = <FutureCallback>__task;
            }

            return this.submit(task, _timeout);
        }

        submitCondition(_condition:ParallelCondition, _timeout:number) {
            if (!(_condition instanceof ParallelCondition)) {
                return;
            }

            return this.submit(function (future) {

                    _condition.onTrue(function () {
                        future.setValue(true);
                    });
                    _condition.onFalse(function () {
                        future.setValue(true);
                    });

                    _condition.execute();

                },
                _timeout);
        }

        /**
         * Register a function as observer for Dispatcher lazy event.
         * @param l { DispatcherCallback }
         * @return {*}
         */
        addIsEmptyListener(l:DispatcherCallback) {
            this._isEmptySignal.addListener(l);
            return this;
        }

        /**
         * Execute a queued task.
         * Tasks are processed FIFO.
         *
         * @private
         */
        __executeTask() {

            if (this._pendingTasks.length && this._workers.length) {
                var task = this._pendingTasks.shift();
                var worker = this._workers.shift();
                worker.run(task);
            }

            if (!this._pendingTasks.length) {
                this._isEmptySignal.emit(this);
            }
        }

        /**
         * Internally notified when a worker ends executing its assigned task.
         * @param worker {Worker}
         * @private
         */
        __workerNotBusy(worker:Worker) {
            if (!worker.isTimedOut()) {
                this._workers.push(worker);
            } else {
                this._workers.push(__createWorker(this));
            }
            this.__executeTask();
        }

        /**
         * Internally notified when a worker times out.
         * @param worker {Worker}
         * @private
         */
        __workerTimedOut(worker:Worker) {
            worker.kill();
            this.__executeTask();
        }
    }

    /**
     *
     * @param _task {Array.<function>}
     * @param auditArguments {Array.<{ Array, Object }>}
     * @param fnIndex {number}
     *
     * @private
     *
     * @return {string}
     */
    function __getSequenceStackTrace(_task:FutureCallback[], auditArguments:AuditArgument[], fnIndex:number) {

        function __stringify(v:any) {
            try {
                return JSON.stringify(v);
            } catch (e1) {
                return v.toString();
            }
        }

        function __args(...args:any[]) {
            str = 'args=[';
            for (let j = 0; j < args.length; j++) {
                str += __stringify(args[j]);
                if (j < args.length - 1) {
                    str += ',';
                }
            }
            str += ']';

            return str;
        }

        var str = '';
        let fnStr:string;
        let strtmp:string;
        var auditArgument:AuditArgument;
        for (let i = 0; i < _task.length; i++) {

            auditArgument = i < auditArguments.length ? auditArguments[i] : null;

            fnStr = _task[i].toString();
            strtmp = fnStr.substring(0, fnStr.indexOf('{'));
            if (i === fnIndex - 1) {
                str += '- [errored] -->' + strtmp;
                /*
                 str+= '  error: [';
                 try {
                 str+= JSON.stringify( auditArgument.ret );
                 } catch(e2) {
                 str+= auditArgument.ret.toString();
                 }
                 str+=']';
                 */

            } else if (i === fnIndex) {
                str += '+ [current] -->' + strtmp;
            } else if (i > fnIndex) {
                str += '+ ' + strtmp;
            } else {
                str += '- ' + strtmp;
            }

            if (auditArgument) {
                str += '  ';
                str += __args(auditArgument.args);

                str += '  ';
                str += 'ret=[';
                str += __stringify(auditArgument.ret);
                str += ']';
            }

            str += '\n';
        }

        return str;

    }
