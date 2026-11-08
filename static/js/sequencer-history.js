(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.SequenceHistory = factory();
}(typeof self !== "undefined" ? self : this, function () {
    function History(initial) {
        this.undoStack = [];
        this.redoStack = [];
        this.current = initial;
    }
    History.prototype.apply = function (next) {
        this.undoStack.push(this.current);
        this.current = next;
        this.redoStack = [];
    };
    History.prototype.undo = function () {
        if (!this.undoStack.length) return this.current;
        this.redoStack.push(this.current);
        this.current = this.undoStack.pop();
        return this.current;
    };
    History.prototype.redo = function () {
        if (!this.redoStack.length) return this.current;
        this.undoStack.push(this.current);
        this.current = this.redoStack.pop();
        return this.current;
    };
    return History;
}));
