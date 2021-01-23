const Status = {
    INITIATED: `Initiated`,
    PENDING: `Pending`,
    FULFILLED: `Fulfilled`,
    REJECTED: `Rejected`,
}

class MyPromise {
    constructor(callback, status = Status.PENDING) {
        this._callback = callback
        this._status = status
        this._child = null
        this._response = null
        this._error = null

        this._onSuccess = this._onSuccess.bind(this)
        this._onError = this._onError.bind(this)

        if (this._status === Status.PENDING) {
            try {
                this._callback(this._onSuccess, this._onError)
            } catch(error) {
                this._onError(error)
            }
        }
    }

    then(thenCallback) {
        const child = new MyPromise(thenCallback, Status.INITIATED)
        this._setChild(child)
        return child
    }

    catch(catchCallback) {
        const customPromise = new MyPromise(() => {}, Status.INITIATED)

        customPromise._onError = error => {
            catchCallback(error)
        }

        this._setChild(customPromise)
        return customPromise
    }

    _setChild(child) {
        this._child = child
        if (this._status === Status.FULFILLED) {
            child._pipe(this._response)
        } else if (this._status === Status.REJECTED) {
            child._onError(this._error)
        }
    }

    _pipe(parentResponse) {
        try {
            const result = this._callback(parentResponse) || parentResponse

            if (result instanceof MyPromise) {
                result.then(response => {
                    this._onSuccess(response)
                })
            } else {
                this._onSuccess(result)
            }

        } catch(error) {
            this._onError(error);
        }
    }

    _resolve(response) {
        this._response = response
        this._status = Status.FULFILLED
        if (this._child) this._child._pipe(response)
    }

    _reject(error) {
        this._error = error
        this._status = Status.REJECTED
        if (this._child) this._child._onError(error)
    }

    _onSuccess(response) {
        this._resolve(response)
        this._finish()
    }

    _onError(error) {
        this._reject(error)
        this._finish()
    }

    _finish() {
        this._resolve = () => {}
        this._reject = () => {}
    }
}

// Test 1: Ошибка внутри коллбэка then должна проваливаться в следующий catch

const test1 = () => {
    new MyPromise((onSuccess) => {
        onSuccess()
    }).then(() => {
        throw new Error()
    }).catch(() => {
        console.log(`Test 1 passed`)
    })
}

test1()

// Test 2: Ошибка внутри коллбэка new MyPromise() должна проваливаться в следующий catch

const test2 = () => {
    new MyPromise(() => {
        throw new Error()
    }).catch(() => {
        console.log(`Test 2 passed`)
    })
}

test2()

// Test 3: Если коллбэк then возвращает MyPromise, цепочка передаётся ему

const test3 = () => {
    new MyPromise(onSuccess => {
        onSuccess(1)
    }).then(response => {
        return new MyPromise(onSuccess => {
            setTimeout(() => {
                onSuccess(response + 1)
            }, 1000)
        })
    }).then(response => {
        return response + 1
    }).then(response => {
        if (response === 3) console.log(`Test 3 passed`)
    })
}

test3()

// Test 4: Разорванные цепочки работают корректно, асинхронность работает корректно

const test4 = () => {
    const firstPromise = new MyPromise(onSuccess => {
        setTimeout(() => {
            onSuccess(1)
        }, 1000)
    })
    
    const secondPromise = firstPromise.then(response => {
        return new MyPromise(onSuccess => {
            setTimeout(() => {
                onSuccess(response + 1)
            }, 1000)
        })
    })
    
    const thirdPromise = secondPromise.then(response => {
        return new MyPromise(onSuccess => {
            setTimeout(() => {
                onSuccess(response + 1)
            }, 1000)
        })
    })
    
    thirdPromise.then(response => {
        if (response === 3) console.log(`Test 4 passed`)
    })
}

test4()

// Test 5: Никакая последовательность then / catch не нарушает работу MyPromise

const test5 = () => {
    new MyPromise(onSuccess => {
        onSuccess(1)
    })
        .catch(() => {
            console.log(`Test 5.1 failed`)
        })
        .catch(() => {
            console.log(`Test 5.1 failed`)
        })
        .then(response => response + 1)
        .then(response => response + 1)
        .catch(() => {
            console.log(`Test 5.1 failed`)
        })
        .then(response => {
            if (response === 3) console.log(`Test 5.1 passed`)
        })
    
    new MyPromise(onSuccess => {
        onSuccess(1)
    })
        .catch(() => {
            console.log(`Test 5.2 failed`)
        })
        .catch(() => {
            console.log(`Test 5.2 failed`)
        })
        .then(() => {
            throw new Error(`error 2`)
        })
        .then(() => {
            throw new Error(`error 3`)
        })
        .catch(error => {
            if (error.message === `error 2`) console.log(`Test 5.2 passed`)
        })
        .then(response => {
            if (response === 3) console.log(`Test 5.2 failed`)
        })
}

test5()

// Test 6: Если во внутреннем MyPromise сработал catch, внешняя цепочка (включая catch) не продолжается

const test6 = () => {
    let result = ``

    new MyPromise(onSuccess => {
        onSuccess()
    }).then(() => {
        return new MyPromise(() => {
            throw new Error(`error 1`)
        }).catch(error => {
            result = error.message
        })
    }).then(() => {
        result += `, then`
    }).catch(error => {
        result += `, ${error.message}`
    })

    console.log(`Test 6 ${result === `error 1` ? `passed` : `failed`}`)
}

test6()