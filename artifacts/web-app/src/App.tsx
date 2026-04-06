import { Switch, Route } from "wouter";
import Landing from "./pages/landing";
import Consent from "./pages/consent";
import Onboarding from "./pages/onboarding";
import Setup from "./pages/setup";
import Session from "./pages/session";
import Feedback from "./pages/feedback";
import Replay from "./pages/replay";
import History from "./pages/history";
import NotFound from "./pages/not-found";

export default function App() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/consent" component={Consent} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/setup" component={Setup} />
      <Route path="/session" component={Session} />
      <Route path="/feedback" component={Feedback} />
      <Route path="/replay" component={Replay} />
      <Route path="/history" component={History} />
      <Route component={NotFound} />
    </Switch>
  );
}
