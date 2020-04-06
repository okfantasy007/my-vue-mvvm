class Vue {
	constructor(options) {
		// options包含 el、data、computed、methods
		this.$el = options.el;// this.$el = "#app"
		this.$data = options.data;
		this.$computed = options.computed;
		this.$method = options.method;
		// 编译模板，将初始值注入模板
		if (this.$el) {
			new Observer(this);
			for (let key in this.$computed) {
				// {{getSonInfo}} vm.$data.getSonInfo，代理到vm.$data，相当于把getSonInfo作为data的一个属性处理
				// 只不过该属性为函数
				const fn = this.$computed[key];
				Object.defineProperty(this.$data, key, {
					get() {
						return fn.call(this);
					}
				})
			}
			for (let key in this.$method) {
				const fn = this.$method[key];
				Object.defineProperty(this.$data, key, {
					get() {
						return fn;
					}
				});
			}
			console.log("this.$data", this.$data);
			this.proxyVm(this.$data);
			new Compiler(this.$el, this);
		}
	}
	proxyVm(data) {
		// 数据代理，vm.$data.person -> vm.person
		console.log("proxyVm data", data);
		for (let key in data) {
			console.log("proxyVm key", key);
			Object.defineProperty(this, key, {
				get() {
					return data[key];
				},
				set(newValue) {
					if (newValue) {
						data[key] = newValue;
					}
				}
			})
		}
	}
}

class Dep {
	constructor() {
		this.watchers = [];
	}

	addWatcher(watcher) {
		this.watchers.push(watcher);
	}

	notify() {
		this.watchers.forEach((watcher) => {
			watcher.update();
		})
	}
}

/*
watch: {
	'person.name': (newValue) => {}
}
*/

class Watcher {
	constructor(vm, expr, cb) {
		this.vm = vm;
		this.expr = expr;
		this.cb = cb;
		// 先获取并存储一个老值
		this.oldValue = this.getValue(expr);
	}

	getValue(expr) {
		Dep.target = this;
		let data = this.vm.$data;
		const exprArr = expr.split(".");// ["person", "name"]
		let value = "";
		exprArr.forEach((key) => {
			value = data[key];
			data = data[key];
		});
		Dep.target = null;
		// console.log(value);
		return value;
	}

	update() {
		const newValue = this.getValue(this.expr);
		// cb的作用是拿到新值后，重新编译模板
		if (newValue !== this.oldValue) {
			this.cb(newValue);
		}
	}
}

class Observer {
	constructor(vm) {
		this.vm = vm;
		this.observer(vm.$data);
	}

	observer(data) {
		if (data && typeof data === "object") {
			for (let key in data) {
				// 循环递归给整个大对象设置getter 和 setter
				this.defineReactive(data, key, data[key]);
			}
		}
		// console.log("observer data", data);
	}

	defineReactive(obj, key, value) {
		if (value && typeof value === "object") {
			this.observer(value);
		}
		// 给每个属性添加发布、订阅功能
		let dep = new Dep();
		Object.defineProperty(obj, key, {
			get() {
				Dep.target && dep.addWatcher(Dep.target);
				return value;
			},
			set(newValue) {
				if (newValue !== value) {
					value = newValue;
					dep.notify();
				}
			}
		})
	}
}

class Compiler {
	constructor(el, vm) {
		// 根据el选择器获取根节点
		this.el = this.isElementNode(el) ? el : document.querySelector(el);// this.el为真实dom节点
		this.vm = vm;
		let fragment = this.node2fragment(this.el);
		this.compile(fragment);
		this.el.appendChild(fragment);
	}

	isElementNode(node) {
		return node.nodeType === 1;
	}

	node2fragment(el) {
		// console.log(el);
		let fragment = document.createDocumentFragment();
		let child = el.firstChild;
		while (child) {
			// console.log(el);
			// 如果使用appendChid方法将原dom树中的节点添加到DocumentFragment中时，会删除原来的节点
			fragment.appendChild(child);
			child = el.firstChild;
		}
		// console.log(fragment);
		return fragment;
	}

	// 通过表达式去取值 person.name
	setElementInitialValue(node, expr) {
		let data = this.vm.$data;
		const exprArr = expr.split(".");// ["person", "name"]
		let value = "";
		exprArr.forEach((key) => {
			value = data[key];
			data = data[key];
		});
		// console.log(value);
		node.value = value;
	}

	setElementInitialTextValue(node, expr) {
		let data = this.vm.$data;
		let value = "";
		const exprArr = expr.split(".");// ["person", "name"]
		exprArr.forEach((key) => {
			value = data[key];
			data = data[key];
		});
		// console.log(value);
		// console.log("data", data);
		// console.log("this.vm.$data", this.vm.$data);
		node.textContent = value;
	}

	isDirective(name) {
		return name.startsWith("v-");
	}

	isBindMethod(name) {
		return name.startsWith("v-on");
	}

	setVModelValue(expr, value) {
		let data = this.vm.$data;
		const exprArr = expr.split(".");
		for (let i = 0; i < exprArr.length; i++) {
			const key = exprArr[i];
			if (i === exprArr.length - 1) {
				data[key] = value;
			} else {
				data = data[key];
			}
		}
	}

	compileElement(node) {
		// <input type="text" v-model="person.name"/>
		// // console.log([node.attributes]);
		const attributes = node.attributes;
		[...attributes].forEach((attr) => {
			// console.log(attr);
			// name可能是 v-model v-html
			const {name, value: expr} = attr;
			// console.log("compileElement", name, expr);
			if (this.isDirective(name)) {
				if (name === "v-model") {
					// 如果是指令 v-model，需要给输入框赋值 value
					new Watcher(this.vm, expr, (newValue) => {
						this.setElementInitialValue(node, expr);
					});
					this.setElementInitialValue(node, expr);
					node.addEventListener("input", (e) => {
						// 此处会造成页面卡顿
						this.setVModelValue(expr, e.target.value);
					})
				} else {
					if (this.isBindMethod(name)) {
						const [, eventName] = name.split("v-on:");
						console.log("eventName", eventName);
						node.addEventListener(eventName, () => {
							this.vm.$data[expr].call(this.vm);
						})
					}
				}

			}
		});
	}

	compileText(node) {
		// {{person.name}}
		// 后续还要考虑这种情况：{{person.name}} {{person.age}}
		const text = node.textContent;
		// console.log("text", text);
		text.replace(/\{\{(.+?)\}\}/g, (...args) => {
			// console.log(args);// person.name
			new Watcher(this.vm, args[1], (newValue) => {
				this.setElementInitialTextValue(node, args[1]);
			});
			this.setElementInitialTextValue(node, args[1]);
		});
	}

	compile(node) {
		// console.log([...node.childNodes]);
		[...node.childNodes].forEach(childNode => {
			// console.log(childNode);
			if (this.isElementNode(childNode)) {
				// 如果是元素节点，不仅要编译本节点，而且要对子节点进行遍历
				this.compileElement(childNode);
				this.compile(childNode);
			} else {
				// 如果是文本 {{a}} {{b}}
				this.compileText(childNode);
			}
		})
	}
}

const vm = new Vue({
	el: "#app",
	data: {
		person: {
			name: "alice",
			age: 40,
			son: {
				name: "bob",
				age: 14
			}
		}
	},
	computed: {
		getSonInfo() {
			// this.person.son.name -> this.data.person.son.name，数据代理
			return "儿子 -> 姓名：" + this.person.son.name + " & 年龄：" + this.person.son.age;
		}
	},
	method: {
		otherMethod() {
			this.person.name = "周星驰";
		},
		changeText() {
			console.log("handleBar");
			this.$method.otherMethod.call(this);
			this.person.son.name = "武则天";
		}
	}
});
console.log(vm);
