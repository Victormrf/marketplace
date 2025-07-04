"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeNullFields = removeNullFields;
exports.removeNullFieldsFromArray = removeNullFieldsFromArray;
function removeNullFields(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([_, value]) => value !== null));
}
function removeNullFieldsFromArray(arr) {
    return arr.map(removeNullFields);
}
