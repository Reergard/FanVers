import styles from "./Profile.module.css";

export function Profile() {
    return (
        <section className={styles.page}>
                 {/* верх */}
                 <div className={styles.top}>
                    <div className={styles.topInner}>
                      <a href="/">Головна</a> <span>›</span> <span>Профіль</span>
                    </div>
                    
                    <h1 className={styles.title}>Профіль</h1>

                    <p className={styles.lead}>
                        Цілий “не” – заповнювальний експерт… (тут буде контент з бекенда)
                    </p>
                 </div>
        </section>
    );
}

export default Profile;