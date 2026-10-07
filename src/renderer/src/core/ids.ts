import { customAlphabet } from 'nanoid';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 10-char URL-safe id for elements, nodes, rows, columns. */
export const newId: () => string = customAlphabet(alphabet, 10);
