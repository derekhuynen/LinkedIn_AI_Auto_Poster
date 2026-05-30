import type { Metadata } from 'next';
import {
	Bricolage_Grotesque,
	Hanken_Grotesk,
	JetBrains_Mono,
} from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({
	subsets: ['latin'],
	weight: ['600', '700'],
	variable: '--ff-display',
});
const body = Hanken_Grotesk({
	subsets: ['latin'],
	weight: ['400', '500'],
	variable: '--ff-body',
});
const mono = JetBrains_Mono({
	subsets: ['latin'],
	weight: ['500'],
	variable: '--ff-mono',
});

export const metadata: Metadata = {
	title: 'LinkedIn AI Auto Poster',
	description:
		'An AI content pipeline on Azure: GPT-4.1 and DALL-E 3 generate and publish LinkedIn posts on a schedule.',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${display.variable} ${body.variable} ${mono.variable}`}
		>
			<body>{children}</body>
		</html>
	);
}
