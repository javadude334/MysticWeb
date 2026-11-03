import Link from "next/link";
import { Shell } from "@/components/shell";
import { defaultNavigation } from "@/lib/navigation/default-navigation";
import styles from "../dashboard/mystic-theme.module.css";

export default function MainMenuPage() {
  return <Shell active="/main-menu">
    <section className="panel">
      <h1>Main Menu</h1>
      <p>Choose a BBS feature, or use the navigation collections in the sidebar.</p>
    </section>
    <nav className={styles.menuGrid} aria-label="BBS main menu">
      {defaultNavigation.filter(item => item.enabled !== false && item.href !== "/dashboard" && item.href !== "/main-menu").map(item =>
        <Link key={item.href} href={item.href} className={styles.menuItem}>
          <span className={styles.menuIcon} aria-hidden="true">{item.icon}</span>
          <strong>{item.name}</strong><p>{item.description}</p>
        </Link>)}
    </nav>
  </Shell>;
}
