import { ComputerGameClient } from './computer-game-client';

interface Props {
  params: { gameId: string };
}

export default function ComputerGamePage({ params }: Props) {
  return <ComputerGameClient gameId={params.gameId} />;
}
