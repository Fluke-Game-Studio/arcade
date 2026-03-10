import React from "react";

export type BotStatus =
  | "neutral"
  | "speaking"
  | "thinking"
  | "listening"
  | "computing";

export default function BotAvatar2DBit({
  status = "neutral",
  size = 92,
}: {
  status?: BotStatus;
  size?: number;
}) {
  const scale = size / 240;

  return (
    <>
      <div
        className="fluke-bot-wrap"
        style={{
          width: size,
          height: size,
          flexShrink: 0,
        }}
      >
        <div
          className={`fluke-bot ${status || "neutral"}`}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <div className="fluke-bot-head">
            <div className="fluke-bot-left-ear">
              <div className="fluke-bot-left-ear-inner" />
            </div>

            <div className="fluke-bot-face">
              <div className="fluke-bot-eyes">
                <div className="fluke-bot-left-eye" />
                <div className="fluke-bot-right-eye" />
              </div>
              <div className="fluke-bot-mouth" />
            </div>

            <div className="fluke-bot-right-ear">
              <div className="fluke-bot-right-ear-inner" />
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
          .fluke-bot-wrap {
            position: relative;
            overflow: visible;
          }

          .fluke-bot {
            position: relative;
            width: 240px;
            height: 240px;
            min-width: 240px;
            min-height: 240px;
          }

          .fluke-bot-head {
            position: relative;
            display: inline-block;
            margin-top: 15%;
            margin-left: 10%;
            width: 80%;
            height: 70%;
          }

          .fluke-bot-face {
            position: absolute;
            inset: 0;
            border: 0.4em solid #e8d7b7;
            border-radius: 1.5em;
            background: linear-gradient(
              180deg,
              rgba(255,248,235,0.02),
              rgba(255,248,235,0.06)
            );
            box-shadow:
              inset 0 0 20px rgba(255,255,255,0.02),
              0 0 24px rgba(193,154,107,0.06);
          }

          .fluke-bot-left-ear,
          .fluke-bot-right-ear {
            position: absolute;
            top: 30%;
            width: 6%;
            height: 25%;
            border: 0.15em solid #e8d7b7;
            background-color: #b88a4a;
            border-radius: 0.1em;
          }

          .fluke-bot-left-ear {
            left: -6%;
          }

          .fluke-bot-right-ear {
            right: -6%;
          }

          .fluke-bot-left-ear-inner,
          .fluke-bot-right-ear-inner {
            position: absolute;
            top: 20%;
            width: 100%;
            height: 60%;
            background-color: #d9b67a;
            border-radius: 0.1em;
          }

          .fluke-bot-left-ear-inner {
            left: -150%;
          }

          .fluke-bot-right-ear-inner {
            right: -150%;
          }

          .fluke-bot-eyes {
            position: absolute;
            width: 70%;
            height: 20%;
            margin-left: 16%;
            margin-top: 20%;
          }

          .fluke-bot-left-eye,
          .fluke-bot-right-eye {
            position: absolute;
            width: 35%;
            height: 100%;
            background: linear-gradient(180deg, #9ec5ff, #5f8fd9);
            border-radius: 0.5em;
            box-shadow: 0 0 14px rgba(116,169,255,0.24);
          }

          .fluke-bot-right-eye {
            right: 0%;
          }

          .fluke-bot-mouth {
            position: absolute;
            width: 30%;
            height: 4%;
            border-left: 0.2em solid #e8d7b7;
            border-right: 0.2em solid #e8d7b7;
            border-bottom: 0.2em solid #e8d7b7;
            border-top: 0;
            border-radius: 0.5em;
            left: 35%;
            bottom: 20%;
          }

          /* Neutral */
          .fluke-bot.neutral .fluke-bot-left-eye,
          .fluke-bot.neutral .fluke-bot-right-eye {
            animation: fluke-bot-blink-eyes 3s infinite ease-in alternate;
            animation-delay: 2s;
          }

          .fluke-bot.neutral .fluke-bot-left-ear-inner {
            animation: fluke-bot-move-left-ear-inner 5s infinite ease alternate;
          }

          .fluke-bot.neutral .fluke-bot-right-ear-inner {
            animation: fluke-bot-move-right-ear-inner 5s infinite ease alternate;
          }

          @keyframes fluke-bot-blink-eyes {
            0% { height: 10%; margin-top: 10%; }
            10% { height: 100%; margin-top: 0%; }
            100% { height: 100%; margin-top: 0%; }
          }

          /* Speaking */
          .fluke-bot.speaking .fluke-bot-mouth {
            border-top: 0.2em solid #e8d7b7;
            background-color: #f3e6cf;
            animation: fluke-bot-speak-mouth 1s infinite ease alternate;
          }

          @keyframes fluke-bot-speak-mouth {
            0% { width: 10%; height: 4%; left: 45%; }
            25% { width: 30%; height: 10%; left: 35%; }
            50% { width: 6%; height: 4%; left: 47%; }
            75% { width: 40%; height: 8%; left: 30%; }
            100% { width: 30%; height: 4%; left: 35%; }
          }

          /* Thinking */
          .fluke-bot.thinking .fluke-bot-eyes {
            animation: fluke-bot-glance-eyes 8s infinite ease-in-out;
            animation-delay: 0.8s;
          }

          .fluke-bot.thinking .fluke-bot-mouth {
            animation: fluke-bot-pinch-mouth 6s infinite ease alternate;
            animation-delay: 1.2s;
          }

          .fluke-bot.thinking .fluke-bot-left-ear-inner {
            animation: fluke-bot-move-left-ear-inner 6s infinite ease alternate;
            animation-delay: 1s;
          }

          .fluke-bot.thinking .fluke-bot-right-ear-inner {
            animation: fluke-bot-move-right-ear-inner 6s infinite ease alternate;
            animation-delay: 1s;
          }

          @keyframes fluke-bot-glance-eyes {
            0% { margin-left: 16%; }
            10% { margin-left: 6%; }
            40% { margin-left: 6%; }
            60% { margin-left: 24%; }
            70% { margin-left: 24%; }
            80% { margin-left: 16%; }
            100% { margin-left: 16%; }
          }

          @keyframes fluke-bot-pinch-mouth {
            0% { width: 30%; left: 35%; }
            48% { width: 30%; left: 35%; }
            50% { width: 10%; left: 45%; }
            52% { width: 30%; left: 35%; }
            100% { width: 30%; left: 35%; }
          }

          @keyframes fluke-bot-move-left-ear-inner {
            0% { left: -150%; }
            48% { left: -150%; }
            50% { left: -100%; }
            52% { left: -150%; }
            100% { left: -150%; }
          }

          @keyframes fluke-bot-move-right-ear-inner {
            0% { right: -150%; }
            48% { right: -150%; }
            50% { right: -100%; }
            52% { right: -150%; }
            100% { right: -150%; }
          }

          /* Listening */
          .fluke-bot.listening .fluke-bot-left-eye,
          .fluke-bot.listening .fluke-bot-right-eye {
            background: linear-gradient(180deg, #b8f0b8, #6fc56f);
            border-radius: 1em;
            transition: border-radius 0.25s linear;
            animation: none;
            box-shadow: 0 0 14px rgba(111,197,111,0.25);
          }

          .fluke-bot.listening .fluke-bot-left-ear,
          .fluke-bot.listening .fluke-bot-right-ear,
          .fluke-bot.listening .fluke-bot-left-ear-inner,
          .fluke-bot.listening .fluke-bot-right-ear-inner {
            background-color: #7ecb7e;
          }

          .fluke-bot.listening .fluke-bot-face,
          .fluke-bot.listening .fluke-bot-left-ear,
          .fluke-bot.listening .fluke-bot-right-ear {
            border-color: #8ed58e;
            transition: border-color 0.25s linear;
          }

          .fluke-bot.listening .fluke-bot-left-ear-inner,
          .fluke-bot.listening .fluke-bot-right-ear-inner {
            animation: fluke-bot-border-bump 0.4s infinite ease alternate;
            animation-delay: 0.5s;
          }

          @keyframes fluke-bot-border-bump {
            0% {
              outline: 0.4em dotted #8ed58e;
            }
            100% {
              outline: 0.2em dotted transparent;
            }
          }

          /* Computing */
          .fluke-bot.computing .fluke-bot-left-eye,
          .fluke-bot.computing .fluke-bot-right-eye {
            height: 100%;
            width: 25%;
            border-radius: 100%;
            transition: all 0.25s linear;
            border: 0.3em dashed #142033;
            animation-delay: 0.5s;
            background: linear-gradient(180deg, #d6f8ff, #7fd4f0);
          }

          .fluke-bot.computing .fluke-bot-left-eye {
            animation: fluke-bot-border-dance 1s infinite linear reverse;
          }

          .fluke-bot.computing .fluke-bot-right-eye {
            animation: fluke-bot-border-dance 1s infinite linear;
          }

          .fluke-bot.computing .fluke-bot-face,
          .fluke-bot.computing .fluke-bot-left-ear,
          .fluke-bot.computing .fluke-bot-right-ear,
          .fluke-bot.computing .fluke-bot-left-ear-inner,
          .fluke-bot.computing .fluke-bot-right-ear-inner {
            border-color: #8ddbf2;
            transition: border-color 0.25s linear;
          }

          .fluke-bot.computing .fluke-bot-left-ear,
          .fluke-bot.computing .fluke-bot-right-ear,
          .fluke-bot.computing .fluke-bot-left-ear-inner,
          .fluke-bot.computing .fluke-bot-right-ear-inner {
            background-color: #8ddbf2;
            animation: none;
          }

          .fluke-bot.computing .fluke-bot-mouth {
            border: 0.5em solid #f3e6cf;
            width: 10%;
            left: 45%;
          }

          @keyframes fluke-bot-border-dance {
            100% {
              transform: rotateZ(360deg);
            }
          }
        `}
      </style>
    </>
  );
}