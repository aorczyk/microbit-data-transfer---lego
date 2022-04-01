let sendBluetooth = true;
let sendUSB = false;
let lastReceivedString: String = null;
pfTransmitter.connectIrSenderLed(AnalogPin.P2)
bluetooth.startUartService()
let engine1 = 0
let engine2 = 0
let interval = 500
let legoMode = 0

basic.showIcon(IconNames.Square)

bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
    sendBluetooth = true;
})

bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
    sendBluetooth = false;
})

input.onButtonPressed(Button.A, function () {
    sendBluetooth = !sendBluetooth;
})

input.onButtonPressed(Button.B, function () {
    sendUSB = !sendUSB;
})

input.onButtonPressed(Button.AB, function () {
    legoMode += 1;

    if (legoMode > 1){
        legoMode = 0
    }

    basic.showNumber(legoMode)
})

class Sensor {
    public key: string;
    private handler: () => number;
    private interval: number;
    private lastCheck: number;
    private value: number;
    private lastValue: number;
    private status: boolean;
    private isRunning: boolean;
    private delta: number;
    private sendIf: (value: number, lastValue: number) => boolean;
    private sendOnlyNewValue: boolean;

    constructor(key: string, interval: number, handler: () => number, sendOnlyNewValue: boolean = false, delta: number = null, sendIf: (value: number, lastValue: number) => boolean = null) {
        this.key = key;
        this.interval = interval;
        this.handler = handler;
        this.delta = delta;
        this.sendIf = sendIf;
        this.sendOnlyNewValue = sendOnlyNewValue;
    }

    public getData() {
        return this.handler()
    }

    public setInterval(interval: number): void {
        this.stop()
        this.interval = interval;
        this.start()
    }

    public stop(): void {
        this.status = false;
        while (this.isRunning) {
            basic.pause(10)
        }
    }

    public start(): void {
        this.status = true;
        this.isRunning = true;
        control.runInBackground(() => {
            while (this.status) {
                let getDataStart = input.runningTime();
                let value = this.handler()
                let getDataStop = input.runningTime();

                this.lastCheck = getDataStart
                let send = true;

                if (this.value != null){
                    if (this.delta != null){
                        if (value >= (this.value + this.delta) || value <= (this.value - this.delta)) {
                            this.value = value;
                        } else {
                            send = false
                        }
                    } else {
                        this.value = value;
                    }
                } else {
                    this.value = value;
                }

                if (this.sendOnlyNewValue && this.value == this.lastValue) {
                    send = false
                }

                if (send && typeof this.sendIf == 'function'){
                    send = this.sendIf(this.value, this.lastValue)
                }

                if (send) {
                    let out = [this.key, this.value, this.lastCheck, getDataStop - getDataStart, this.lastValue].join(',') + '\n'
                    this.lastValue = this.value

                    if (sendBluetooth){
                        bluetooth.uartWriteString(out)
                    } else if (sendUSB){
                        // serial.writeNumbers([value, this.lastCheck, getDataStop - getDataStart])
                        serial.writeString(out)
                    }
                }

                basic.pause(this.interval)
            }

            this.isRunning = false;
        })
    }
}

let measurements: Sensor[] = [];

// Temperature
measurements.push(new Sensor('temp', 2000, () => {
    return input.temperature()
}, true))

// Sonar
// measurements.push(new Sensor('sonar', 500, () => {
//     return sonar.ping(DigitalPin.P2, DigitalPin.P1, PingUnit.Centimeters)
// }))

for (let sensor of measurements){
    sensor.start()
}

function getSesorByKey(key: string): Sensor {
    return measurements.filter(s => {
        return s.key == key
    })[0]
}

function messageHandler(receivedString: String){
    let data = receivedString.split(';')

    if (data.length == 1) {
        // music.playTone(Note.C, music.beat())
        basic.showString(data[0])
        return
    }

    if (data[0] == 'sensor') {
        let sensor = getSesorByKey(data[1]);

        if (data[2] == 'interval'){
            sensor.setInterval(+data[3])
        } else if (data[2] == 'status') {
            let status = +data[3]
            if (status){
                sensor.start()
            } else {
                sensor.stop()
            }
        } else if (data[2] == 'get') {
            let out = sensor.getData()

            if (sendBluetooth) {
                bluetooth.uartWriteString(out + '\n')
            } else if (sendUSB) {
                serial.writeString(out + '\n')
            }
        }
        return
    }

    if (data[0] == 'str') {
        // music.playTone(Note.C, music.beat())
        basic.showString(data[1])
        // basic.showIcon(0)
        return
    }

    if (lastReceivedString != receivedString) {
        lastReceivedString = receivedString
        basic.clearScreen()

        if (receivedString == "38;") {
            led.plot(2, 0)
        } else if (receivedString == "39;") {
            led.plot(4, 2)
        } else if (receivedString == "37;") {
            led.plot(0, 2)
        } else if (receivedString == "40;") {
            led.plot(2, 4)
        } else if (receivedString == "38;39;") {
            led.plot(4, 0)
        } else if (receivedString == "37;38;") {
            led.plot(0, 0)
        } else if (receivedString == "37;40;") {
            led.plot(0, 4)
        } else if (receivedString == "39;40;") {
           led.plot(4, 4)
        } else {
            led.plot(2, 2)
        }

        if (legoMode == 0){
            let engine1New = 0
            let engine2New = 0

            let keys = receivedString.split(';').map(x => +x)

            for (let key of keys) {
                if (!engine1New && (key == 38 || key == 40 || key == 32)) {
                    engine1New = key
                } else if (!engine2New && (key == 37 || key == 39)) {
                    engine2New = key
                }
            }

            if (engine1 != engine1New) {
                engine1 = engine1New

                if (engine1 == 32) {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Red, PfSingleOutput.BrakeThenFloat)
                } else if (engine1 == 38) {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Red, PfSingleOutput.Backward7)
                } else if (engine1 == 40) {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Red, PfSingleOutput.Forward7)
                } else {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Red, PfSingleOutput.Float)
                }
            }

            if (engine2 != engine2New) {
                engine2 = engine2New

                if (engine2 == 39) {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Blue, PfSingleOutput.Backward7)
                } else if (engine2 == 37) {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Blue, PfSingleOutput.Forward7)
                } else {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Blue, PfSingleOutput.Float)
                }
            }
        }

        if (legoMode == 1) {
            if (receivedString == "38;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Backward7)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Forward7)
            } else if (receivedString == "39;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Backward5)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Backward5)
            } else if (receivedString == "37;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Forward5)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Forward5)
            } else if (receivedString == "40;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Forward7)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Backward7)
            } else if (receivedString == "38;39;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Backward7)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Forward2)
            } else if (receivedString == "37;38;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Backward2)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Forward7)
            } else if (receivedString == "37;40;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Forward2)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Backward7)
            } else if (receivedString == "39;40;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Forward7)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Backward2)
            } else {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Float)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Float)
            }
        }
    }
}

serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function() {
    let receivedString = serial.readUntil(serial.delimiters(Delimiters.NewLine))

    messageHandler(receivedString)
})

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let receivedString = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))

    messageHandler(receivedString)
})