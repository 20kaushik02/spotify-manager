import curriedLogger from "./logger.js";
const logger = curriedLogger(import.meta);

import * as typedefs from "../typedefs.js";

/**
 * Directed graph, may or may not be connected.
 *
 * NOTE: Assumes that nodes and edges are valid.
 *
 * Example:
 * ```javascript
 * let nodes = ["a", "b", "c", "d", "e"];
 * let edges = [
 *		{ from: "a", to: "b" },
 *		{ from: "b", to: "c" },
 *		{ from: "c", to: "d" },
 *		{ from: "d", to: "a" },
 *		{ from: "e", to: "a" }
 *	];
 * let g = new myGraph(nodes, edges);
 * console.log(g.detectCycle()); // true
 * ```
*/
export class myGraph {
  /**
   * @param {string[]} nodes Graph nodes IDs
   * @param {{ from: string, to: string }[]} edges Graph edges b/w nodes
  */
  constructor(nodes, edges) {
    this.nodes = [...nodes];
    this.edges = structuredClone(edges);
  }

  /**
   * @param {string} node
   * @returns {string[]}
   */
  getDirectHeads(node) {
    return this.edges.filter(edge => edge.to == node).map(edge => edge.from);
  }

  /**
   * @param {string} node
   * @returns {{ from: string, to: string }[]}
  */
  getDirectHeadEdges(node) {
    return this.edges.filter(edge => edge.to == node);
  }

  /**
   * BFS
   * @param {string} node
   * @returns {string[]}
  */
  getAllHeads(node) {
    const headSet = new Set();
    const toVisit = new Set(); // queue
    toVisit.add(node);
    while (toVisit.size > 0) {
      const nextNode = toVisit.values().next().value;
      const nextHeads = this.getDirectHeads(nextNode);
      nextHeads.forEach(head => {
        headSet.add(head);
        toVisit.add(head);
      });
      toVisit.delete(nextNode);
    }
    return [...headSet];
  }

  /**
   * @param {string} node
   * @returns {string[]}
  */
  getDirectTails(node) {
    return this.edges.filter(edge => edge.from == node).map(edge => edge.to);
  }

  /**
   * @param {string} node
   * @returns {{ from: string, to: string }[]}
  */
  getDirectTailEdges(node) {
    return this.edges.filter(edge => edge.from == node);
  }

  /**
   * BFS
   * @param {string} node
   * @returns {string[]}
   */
  getAllTails(node) {
    const tailSet = new Set();
    const toVisit = new Set(); // queue
    toVisit.add(node);
    while (toVisit.size > 0) {
      const nextNode = toVisit.values().next().value;
      const nextTails = this.getDirectTails(nextNode);
      nextTails.forEach(tail => {
        tailSet.add(tail);
        toVisit.add(tail);
      });
      toVisit.delete(nextNode);
    }
    return [...tailSet];
  }

  /**
   * Kahn's topological sort
   * @returns {string[]}
   */
  topoSort() {
    let inDegree = {};
    let zeroInDegreeQueue = [];
    let topologicalOrder = [];

    // Initialize inDegree of all nodes to 0
    for (let node of this.nodes) {
      inDegree[node] = 0;
    }

    // Calculate inDegree of each node
    for (let edge of this.edges) {
      inDegree[edge.to]++;
    }

    // Collect nodes with 0 inDegree
    for (let node of this.nodes) {
      if (inDegree[node] === 0) {
        zeroInDegreeQueue.push(node);
      }
    }

    // process nodes with 0 inDegree
    while (zeroInDegreeQueue.length > 0) {
      let node = zeroInDegreeQueue.shift();
      topologicalOrder.push(node);

      for (let tail of this.getDirectTails(node)) {
        inDegree[tail]--;
        if (inDegree[tail] === 0) {
          zeroInDegreeQueue.push(tail);
        }
      }
    }
    return topologicalOrder;
  }

  /**
   * Check if the graph contains a cycle
   * @returns {boolean}
   */
  detectCycle() {
    // If topological order includes all nodes, no cycle exists
    return this.topoSort().length < this.nodes.length;
  }
}

export default myGraph;
