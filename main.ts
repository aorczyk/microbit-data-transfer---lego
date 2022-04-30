let legoMode = 0

pfTransmitter.connectIrSenderLed(AnalogPin.P2)
bluetooth.startUartService()

basic.showIcon(IconNames.Square)

bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
})

bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
})

input.onButtonPressed(Button.AB, function () {
    legoMode += 1;

    if (legoMode > 1){
        legoMode = 0
    }

    basic.showNumber(legoMode)
})

basic.forever(() => {
    let out = [
        input.runningTime(),
        null,
        null,
        null,
        input.acceleration(Dimension.X),
        input.acceleration(Dimension.Y),
        ]
    bluetooth.uartWriteString(out.join(',') + '\n')

    basic.pause(1000)
})

let lastReceivedString: String = null;
let engine1 = 0
let engine2 = 0

function messageHandler(receivedString: String){
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

serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let receivedString = serial.readUntil(serial.delimiters(Delimiters.NewLine))

    messageHandler(receivedString)
})

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let receivedString = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))

    messageHandler(receivedString)
})