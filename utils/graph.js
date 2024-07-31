const logger = require("./logger")(module);

const typedefs = require("../typedefs");

/**
 * Directed graph, may or may not be connected.
 * 
 * NOTE: Assumes that nodes and edges are valid.
 * 
 * Example:
 * ```javascript
 * let nodes = ['a', 'b', 'c', 'd', 'e'];
 * let edges = [
 *		{ from: 'a', to: 'b' },
 *		{ from: 'b', to: 'c' },
 *		{ from: 'c', to: 'd' },
 *		{ from: 'd', to: 'a' },
 *		{ from: 'e', to: 'a' }
 *	];
 * let g = new myGraph(nodes, edges);
 * console.log(g.detectCycle()); // true
 * ```
*/
class myGraph {
	/**
	 * @param {string[]} nodes Graph nodes IDs
	 * @param {{ from: string, to: string }[]} edges Graph edges b/w nodes
	*/
	constructor(nodes, edges) {
		this.nodes = [...nodes];
		this.edges = structuredClone(edges);
	}

	/**
	 * @param {type} node
	 * @returns {string[]}
	 */
	getDirectHeads(node) {
		return this.edges.filter(edge => edge.to == node).map(edge => edge.from);
	}

	/**
	 * @param {type} node
	 * @returns {string[]}
	 */
	getDirectTails(node) {
		return this.edges.filter(edge => edge.from == node).map(edge => edge.to);
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

module.exports = myGraph;
