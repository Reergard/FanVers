import styles from "./HomePage.module.css";
import { Container } from "../shared/Container";
import Home1 from "./HomePage1";
import Home2 from "./HomePage2";
import Home3 from "./HomePage3";

export function HomePage() {
    return (
        <section className={styles.page}>
            <Container>
                <div className={styles.homepage}>
                    <Home1 />
                    <Home2 />
                    <Home3 />
                </div>
            </Container>
        </section>
    );
}

export default HomePage;