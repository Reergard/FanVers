import { useNavigate, useLocation } from "react-router-dom";
import { Container } from "../shared/Container";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/";

  const handleSuccess = () => {
    navigate(from, { replace: true });
  };

  return (
    <section style={{ paddingBlock: "40px", minHeight: "50vh" }}>
      <Container>
        <h1 style={{ marginBottom: "24px", fontFamily: "BadScript" }}>Вхід</h1>
        <LoginForm onSuccess={handleSuccess} />
      </Container>
    </section>
  );
}
