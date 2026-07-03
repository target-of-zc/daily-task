import BallWindow from "./components/BallWindow";
import PanelWindow from "./components/PanelWindow";

interface Props {
  windowLabel: string;
}

export default function App({ windowLabel }: Props) {
  if (windowLabel === "ball") {
    return <BallWindow />;
  }
  return <PanelWindow />;
}
