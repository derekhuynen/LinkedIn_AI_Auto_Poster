import Hero from '@/components/Hero';
import DryRunPanel from '@/components/DryRunPanel';
import Gallery from '@/components/Gallery';
import Footer from '@/components/Footer';

export default function Home() {
	return (
		<main>
			<Hero />
			<DryRunPanel />
			<Gallery />
			<Footer />
		</main>
	);
}
