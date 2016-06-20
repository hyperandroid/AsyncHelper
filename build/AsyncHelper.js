"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
function schedule(f, delay) {
    if (!delay) {
        setImmediate(f);
    }
    else {
        setTimeout(f, delay || 0);
    }
}
function forEachP(arr) {
    arr.forEach(function (elem, index) {
        schedule(function () {
            elem._fn(elem._condition, index);
        });
    });
}
var Signal = (function () {
    function Signal() {
        this._observers = [];
        this._observersOnce = [];
    }
    Signal.prototype.on = function (observer) {
        return this.addListener(observer);
    };
    Signal.prototype.addListener = function (f) {
        this._observers.push(f);
        return this;
    };
    Signal.prototype.addListenerInFrontOfList = function (f) {
        this._observers.unshift(f);
        return this;
    };
    Signal.prototype.removeListener = function (f) {
        var index = this._observers.indexOf(f);
        if (-1 !== index) {
            this._observers.splice(index, 1);
        }
        return this;
    };
    Signal.prototype.removeAllListeners = function () {
        this._observers = [];
        this._observersOnce = [];
        return this;
    };
    Signal.prototype.addListenerOnce = function (f) {
        this._observersOnce.push(f);
        return this;
    };
    Signal.prototype.emit = function () {
        var __arguments = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            __arguments[_i - 0] = arguments[_i];
        }
        this._observers.forEach(function (e) {
            e.apply(e, Array.prototype.slice.call(__arguments));
        });
        this._observersOnce.forEach(function (e) {
            e.apply(e, Array.prototype.slice.call(__arguments));
        });
        this._observersOnce = [];
    };
    return Signal;
}());
exports.Signal = Signal;
(function (BOOL_OPERATOR) {
    BOOL_OPERATOR[BOOL_OPERATOR["NOT_SET"] = -1] = "NOT_SET";
    BOOL_OPERATOR[BOOL_OPERATOR["TRUE"] = 1] = "TRUE";
    BOOL_OPERATOR[BOOL_OPERATOR["FALSE"] = 0] = "FALSE";
})(exports.BOOL_OPERATOR || (exports.BOOL_OPERATOR = {}));
var BOOL_OPERATOR = exports.BOOL_OPERATOR;
var __conditionIndex = 0;
var Condition = (function () {
    function Condition() {
        this._signalConditionStateChange = new Signal();
        this._signalTimeout = new Signal();
        this._b_condition = BOOL_OPERATOR.NOT_SET;
        this._id = 'Condition' + __conditionIndex++;
        this._timerId = null;
    }
    Object.defineProperty(Condition.prototype, "id", {
        get: function () {
            return this._id;
        },
        set: function (id) {
            this._id = id;
        },
        enumerable: true,
        configurable: true
    });
    Condition.prototype.setId = function (id) {
        this.id = id;
        return this;
    };
    Condition.prototype.__emit = function () {
        this._signalConditionStateChange.emit(this);
    };
    Condition.prototype.setTrue = function () {
        if (this._b_condition === BOOL_OPERATOR.TRUE) {
            return this;
        }
        this.__cancelTimer();
        this._b_condition = BOOL_OPERATOR.TRUE;
        this.__emit();
        return this;
    };
    Condition.prototype.setFalse = function () {
        if (this._b_condition === BOOL_OPERATOR.FALSE) {
            return this;
        }
        this.__cancelTimer();
        this._b_condition = BOOL_OPERATOR.FALSE;
        this.__emit();
        return this;
    };
    Condition.prototype.isTrue = function () {
        return this._b_condition === BOOL_OPERATOR.TRUE;
    };
    Condition.prototype.isFalse = function () {
        return this._b_condition === BOOL_OPERATOR.FALSE;
    };
    Condition.prototype.isNotSet = function () {
        return this._b_condition === BOOL_OPERATOR.NOT_SET;
    };
    Condition.prototype.onStateChange = function (callback) {
        this._signalConditionStateChange.addListener(callback);
        return this;
    };
    Condition.prototype.onTrue = function (callback) {
        if (this.isTrue()) {
            schedule(function () {
                callback(this);
            }, 0);
        }
        else {
            (function (me, callback) {
                me._signalConditionStateChange.addListener(function (condition) {
                    if (condition.isTrue()) {
                        callback(me);
                    }
                });
            })(this, callback);
        }
        return this;
    };
    Condition.prototype.onFalse = function (callback) {
        if (this.isFalse()) {
            schedule(function () {
                callback(this);
            }, 0);
        }
        else {
            (function (me, callback) {
                me._signalConditionStateChange.addListener(function (condition) {
                    if (condition.isFalse()) {
                        callback(me);
                    }
                });
            })(this, callback);
        }
        return this;
    };
    Condition.prototype.setTimeout = function (timeout) {
        this._timerId = setTimeout(this.__timeout.bind(this), timeout);
        return this;
    };
    Condition.prototype.__cancelTimer = function () {
        if (this._timerId) {
            clearTimeout(this._timerId);
            this._timerId = null;
        }
    };
    Condition.prototype.__timeout = function () {
        this.setFalse();
        this._timerId = null;
        this._signalTimeout.emit(this);
    };
    Condition.prototype.onTimeout = function (f) {
        this._signalTimeout.addListener(f);
        return this;
    };
    Condition.prototype.disable = function () {
        this._signalConditionStateChange.removeAllListeners();
        this._signalTimeout.removeAllListeners();
    };
    Condition.prototype.getCurrentValue = function () {
        return this._b_condition;
    };
    Condition.prototype.then = function (success, error) {
        this.onTrue(success);
        if (error) {
            this.onFalse(error);
        }
    };
    Condition.prototype.reset = function () {
        this.setNotSet();
        return this;
    };
    Condition.prototype.setNotSet = function () {
        var prev = this._b_condition;
        this._b_condition = BOOL_OPERATOR.NOT_SET;
        if (prev !== BOOL_OPERATOR.NOT_SET) {
            this.__emit();
        }
        return this;
    };
    return Condition;
}());
exports.Condition = Condition;
(function (BOOLEAN_OPERATOR) {
    BOOLEAN_OPERATOR[BOOLEAN_OPERATOR["AND"] = 0] = "AND";
    BOOLEAN_OPERATOR[BOOLEAN_OPERATOR["OR"] = 1] = "OR";
})(exports.BOOLEAN_OPERATOR || (exports.BOOLEAN_OPERATOR = {}));
var BOOLEAN_OPERATOR = exports.BOOLEAN_OPERATOR;
var ConditionTree = (function (_super) {
    __extends(ConditionTree, _super);
    function ConditionTree(operator) {
        _super.call(this);
        this._booleanOperator = typeof operator !== "undefined" ? operator : BOOLEAN_OPERATOR.AND;
        this._children = [];
    }
    ConditionTree.prototype.__isTrueOr = function () {
        var i;
        var notSet = false;
        for (i = 0; i < this._children.length; i++) {
            if (this._children[i].isTrue()) {
                return BOOL_OPERATOR.TRUE;
            }
            else if (this._children[i].isNotSet()) {
                notSet = true;
            }
        }
        return notSet ? BOOL_OPERATOR.NOT_SET : BOOL_OPERATOR.FALSE;
    };
    ConditionTree.prototype.__isTrueAnd = function () {
        var notSet = false;
        for (var i = 0; i < this._children.length; i++) {
            if (this._children[i].isFalse()) {
                return BOOL_OPERATOR.FALSE;
            }
            else if (this._children[i].isNotSet()) {
                notSet = true;
            }
        }
        return notSet ? BOOL_OPERATOR.NOT_SET : BOOL_OPERATOR.TRUE;
    };
    ConditionTree.prototype.__isTrue = function () {
        var value;
        value = (this._booleanOperator === BOOLEAN_OPERATOR.AND) ?
            this.__isTrueAnd() :
            this.__isTrueOr();
        return value;
    };
    ConditionTree.prototype.addCondition = function (condition) {
        this._children.push(condition);
        condition.onStateChange(this.__conditionChanged.bind(this));
        return this;
    };
    ConditionTree.prototype.__conditionChanged = function () {
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
    };
    return ConditionTree;
}(Condition));
exports.ConditionTree = ConditionTree;
var ParallelConditionDescriptor = (function () {
    function ParallelConditionDescriptor(fn, condition) {
        this._condition = condition;
        this._fn = fn;
    }
    return ParallelConditionDescriptor;
}());
exports.ParallelConditionDescriptor = ParallelConditionDescriptor;
var ParallelCondition = (function (_super) {
    __extends(ParallelCondition, _super);
    function ParallelCondition(array, timeout) {
        _super.call(this);
        this.__setIterableArray(array);
        this._timeout = timeout || 0;
    }
    ParallelCondition.prototype.__setIterableArray = function (array) {
        var me = this;
        var iterableArray = [];
        if (array.constructor !== Array) {
            throw "ParallelCondition needs an Array of functions or other ParallelConditions.";
        }
        array.forEach(function (element) {
            var condition;
            if (typeof element === "function") {
                condition = new Condition();
                me.addCondition(condition);
                iterableArray.push(new ParallelConditionDescriptor(element, condition));
            }
            else if (element instanceof ParallelCondition) {
                condition = element;
                me.addCondition(condition);
                iterableArray.push(new ParallelConditionDescriptor(function () {
                    element.execute();
                }, condition));
            }
            else {
                throw new Error("ParallelCondition needs functions or other ParallelCondition as parameters.");
            }
        });
        this._iterableArray = iterableArray;
    };
    ParallelCondition.prototype.execute = function () {
        if (this._timeout > 0) {
            this.setTimeout(this._timeout);
        }
        forEachP(this._iterableArray);
    };
    return ParallelCondition;
}(ConditionTree));
exports.ParallelCondition = ParallelCondition;
var Future = (function () {
    function Future() {
        this._value = null;
        this._valueSetCondition = new Condition();
    }
    Future.prototype.getValue = function () {
        return this._value;
    };
    Future.prototype.isValueSet = function () {
        return this._valueSetCondition.isTrue();
    };
    Future.prototype.setValue = function (v) {
        if (!this._valueSetCondition.isTrue()) {
            this._value = v;
            this._valueSetCondition.setTrue();
        }
    };
    Future.prototype.onValueSet = function (callback) {
        var me = this;
        if (this._valueSetCondition.isTrue()) {
            schedule(function () {
                callback(me);
            });
        }
        this._valueSetCondition.onTrue(callback.bind(null, this));
        return this;
    };
    Future.prototype.then = function (success, error) {
        this.onValueSet(function (f) {
            var v = f.getValue();
            if (v instanceof Error) {
                error(f.getValue());
            }
            else {
                success(v);
            }
        });
    };
    Future.prototype.node = function (callback) {
        this.onValueSet(function (f) {
            var v = f.getValue();
            if (v instanceof Error) {
                callback(f.getValue());
            }
            else {
                callback(undefined, v);
            }
        });
    };
    return Future;
}());
exports.Future = Future;
var WorkerTask = (function () {
    function WorkerTask(task, timeout) {
        this._timeout = timeout;
        this._future = new Future();
        this._task = task;
    }
    WorkerTask.prototype.getTask = function () {
        return this._task;
    };
    WorkerTask.prototype.getTimeout = function () {
        return this._timeout;
    };
    WorkerTask.prototype.getFuture = function () {
        return this._future;
    };
    return WorkerTask;
}());
exports.WorkerTask = WorkerTask;
var __workerIndex = 0;
var Worker = (function () {
    function Worker() {
        this._id = "worker" + __workerIndex++;
        this._workingCondition = new Condition();
        this._timeoutCondition = new Condition();
        this._currentWorkerTask = null;
    }
    Worker.prototype.run = function (workerTask) {
        var future = workerTask.getFuture();
        this._currentWorkerTask = workerTask;
        this._workingCondition.setTrue();
        (function (me, future, timeout) {
            var timeoutId = null;
            setTimeout(function () {
                future.onValueSet(function () {
                    me._workingCondition.setFalse();
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                });
                workerTask.getTask()(future);
            }, 0);
            if (timeout > 0) {
                timeoutId = setTimeout(function () {
                    me._timeoutCondition.setTrue();
                    timeoutId = null;
                }, timeout);
            }
        })(this, future, workerTask.getTimeout());
    };
    Worker.prototype.isWorking = function () {
        return this._workingCondition.isTrue();
    };
    Worker.prototype.isTimedOut = function () {
        return this._timeoutCondition.isTrue();
    };
    Worker.prototype.onWorkDone = function (f) {
        this._workingCondition.onFalse(f);
        return this;
    };
    Worker.prototype.onTimeout = function (f) {
        this._timeoutCondition.onTrue(f);
        return this;
    };
    Worker.prototype.kill = function () {
        console.warn("Worker '" + this._id + "' timeout. Future value as Error.");
        this._currentWorkerTask.getFuture().setValue(new Error("Worker '" + this._id + "' Timeout"));
        this._workingCondition.disable();
        this._timeoutCondition.disable();
    };
    return Worker;
}());
exports.Worker = Worker;
function __createWorkers(dispatcher, concurrency) {
    var workers = [];
    for (var i = 0; i < concurrency; i++) {
        var worker = __createWorker(dispatcher);
        workers.push(worker);
    }
    return workers;
}
function __createWorker(dispatcher) {
    var worker = new Worker();
    worker.onWorkDone(dispatcher.__workerNotBusy.bind(dispatcher, worker));
    worker.onTimeout(dispatcher.__workerTimedOut.bind(dispatcher, worker));
    return worker;
}
var Dispatcher = (function () {
    function Dispatcher(concurrency) {
        this._concurrency = concurrency || 1;
        this._workers = __createWorkers(this, this._concurrency);
        this._pendingTasks = [];
        this._isEmptySignal = new Signal();
    }
    Dispatcher.prototype.submit = function (_task, _timeout) {
        var task = new WorkerTask(_task, _timeout);
        this._pendingTasks.push(task);
        this.__executeTask();
        return task.getFuture();
    };
    Dispatcher.prototype.waterfall = function (__task, _timeout, haltOnError) {
        return this.submitNodeSequence(__task, _timeout, haltOnError);
    };
    Dispatcher.prototype.submitNodeSequence = function (__task, _timeout, haltOnError) {
        if (typeof _timeout === 'undefined') {
            _timeout = 0;
        }
        if (typeof haltOnError === 'undefined') {
            haltOnError = true;
        }
        var task;
        if (Object.prototype.toString.call(__task) === '[object Array]') {
            var _task = __task;
            if (_task.length === 0) {
                task = function (future) {
                    future.setValue(true);
                };
            }
            else {
                task = function (future) {
                    var pendingTasks = Array.prototype.slice.call(_task);
                    var fnIndex = 0;
                    var auditArguments = [];
                    function iterate() {
                        var args = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            args[_i - 0] = arguments[_i];
                        }
                        var fn = pendingTasks.shift();
                        var retValue;
                        fnIndex += 1;
                        var auditArgument = {
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
                        }
                        catch (e) {
                            auditArgument.ret = e;
                            if (haltOnError) {
                                var error = new Error(e);
                                error.sequenceStacktrace = __getSequenceStackTrace(_task, auditArguments, fnIndex);
                                future.setValue(error);
                            }
                            else {
                                setImmediate(iterate, e);
                            }
                        }
                    }
                    iterate();
                };
            }
        }
        else {
            task = __task;
        }
        return this.submit(task, _timeout);
    };
    Dispatcher.prototype.submitCondition = function (_condition, _timeout) {
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
        }, _timeout);
    };
    Dispatcher.prototype.addIsEmptyListener = function (l) {
        this._isEmptySignal.addListener(l);
        return this;
    };
    Dispatcher.prototype.__executeTask = function () {
        if (this._pendingTasks.length && this._workers.length) {
            var task = this._pendingTasks.shift();
            var worker = this._workers.shift();
            setTimeout(function () {
                worker.run(task);
            }, 0);
        }
        if (!this._pendingTasks.length && this._workers.length === this._concurrency) {
            this._isEmptySignal.emit(this);
        }
    };
    Dispatcher.prototype.__workerNotBusy = function (worker) {
        if (!worker.isTimedOut()) {
            this._workers.push(worker);
        }
        else {
            this._workers.push(__createWorker(this));
        }
        this.__executeTask();
    };
    Dispatcher.prototype.__workerTimedOut = function (worker) {
        worker.kill();
        this.__executeTask();
    };
    return Dispatcher;
}());
exports.Dispatcher = Dispatcher;
function __getSequenceStackTrace(_task, auditArguments, fnIndex) {
    function __stringify(v) {
        try {
            return JSON.stringify(v);
        }
        catch (e1) {
            return v.toString();
        }
    }
    function __args() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        str = 'args=[';
        for (var j = 0; j < args.length; j++) {
            str += __stringify(args[j]);
            if (j < args.length - 1) {
                str += ',';
            }
        }
        str += ']';
        return str;
    }
    var str = '';
    var fnStr;
    var strtmp;
    var auditArgument;
    for (var i = 0; i < _task.length; i++) {
        auditArgument = i < auditArguments.length ? auditArguments[i] : null;
        fnStr = _task[i].toString();
        strtmp = fnStr.substring(0, fnStr.indexOf('{'));
        if (i === fnIndex - 1) {
            str += '- [errored] -->' + strtmp;
        }
        else if (i === fnIndex) {
            str += '+ [current] -->' + strtmp;
        }
        else if (i > fnIndex) {
            str += '+ ' + strtmp;
        }
        else {
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
//# sourceMappingURL=AsyncHelper.js.map