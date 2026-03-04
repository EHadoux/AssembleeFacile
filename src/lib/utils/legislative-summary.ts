/**
 * Returns a plain-language summary of where the bill currently stands
 * and what steps remain before complete adoption or final rejection.
 * Computed statically from stepsName + stepsStatus arrays.
 * Written for citizens unfamiliar with the legislative process — no jargon.
 */
export function getLegislativeSummary(stepsName: string[], stepsStatus: string[]): string {
	if (stepsName.length === 0) return '';

	const n = (i: number) => (stepsName[i] ?? '').toLowerCase();
	const s = (i: number) => (stepsStatus[i] ?? '').toLowerCase();

	// Last step with any non-empty status (= current state)
	let lastDoneIdx = -1;
	for (let i = stepsStatus.length - 1; i >= 0; i--) {
		if (stepsStatus[i]?.trim()) {
			lastDoneIdx = i;
			break;
		}
	}

	if (lastDoneIdx === -1) {
		return "La proposition vient d'être déposée. Elle n'a pas encore été examinée.";
	}

	// Last step with a definitive vote outcome (adopté/rejeté) — may be before lastDoneIdx
	let lastVoteIdx = -1;
	for (let i = stepsStatus.length - 1; i >= 0; i--) {
		if (s(i).includes('adopté') || s(i).includes('rejeté')) {
			lastVoteIdx = i;
			break;
		}
	}

	// --- Promulguée → devenue loi ---

	if (n(lastDoneIdx).includes('promulgation')) {
		return 'Cette proposition est devenue loi.';
	}

	// --- Conseil constitutionnel ---

	if (n(lastDoneIdx).includes('conseil constitutionnel')) {
		if (s(lastDoneIdx).includes('adopté') || s(lastDoneIdx).includes('conforme')) {
			return "Le texte a été validé sur le plan constitutionnel. Il ne reste plus qu'à le signer officiellement pour qu'il entre en vigueur.";
		}
		return "Le texte a été approuvé par les deux assemblées. Des parlementaires ont saisi le Conseil constitutionnel pour vérifier qu'il respecte la Constitution.";
	}

	// --- Commission Mixte Paritaire ---

	if (n(lastDoneIdx).includes('commission mixte')) {
		if (s(lastDoneIdx).includes('adopté')) {
			return "Députés et sénateurs se sont mis d'accord sur un texte commun. Il ne reste plus qu'à le signer officiellement.";
		}
		if (s(lastDoneIdx).includes('rejeté')) {
			return "Les négociations entre députés et sénateurs ont échoué. Les députés peuvent avoir le dernier mot.";
		}
		return "Députés et sénateurs n'ont pas réussi à s'accorder sur le même texte. Un groupe de 14 parlementaires tente de trouver un compromis.";
	}

	// --- Dernière étape complétée = un vote en séance plénière ---

	if (n(lastDoneIdx).includes('lecture')) {
		const isAN = n(lastDoneIdx).includes('assemblée');
		const isSN = n(lastDoneIdx).includes('sénat');
		const isAdopted = s(lastDoneIdx).includes('adopté');
		const isRejected = s(lastDoneIdx).includes('rejeté');
		const isInProgress = !isAdopted && !isRejected;

		if (n(lastDoneIdx).includes('définitive')) {
			if (isAdopted)
				return "Les députés ont approuvé le texte définitivement. Il ne reste plus qu'à le signer officiellement.";
			if (isRejected)
				return "Les députés ont rejeté le texte en dernier ressort. La proposition ne peut pas devenir loi.";
			return "Les deux assemblées n'ont pas réussi à s'entendre. Les députés examinent maintenant le texte pour trancher définitivement.";
		}

		if (n(lastDoneIdx).includes('nouvelle') || n(lastDoneIdx).includes('deuxième')) {
			if (isAdopted) {
				if (isSN)
					return "Les sénateurs ont approuvé le texte à nouveau. Les deux assemblées doivent encore se mettre d'accord pour que la loi soit promulguée.";
				return "Les députés ont approuvé le texte à nouveau. Les deux assemblées doivent encore se mettre d'accord pour que la loi soit promulguée.";
			}
			if (isRejected) {
				if (isSN) return "Les sénateurs ont rejeté le texte. Les débats se poursuivent.";
				return "Les députés ont rejeté le texte. Les débats se poursuivent.";
			}
			if (isSN) return "Les sénateurs réexaminent le texte. Les deux assemblées n'ont pas encore trouvé un accord.";
			return "Les députés réexaminent le texte. Les deux assemblées n'ont pas encore trouvé un accord.";
		}

		// Première lecture
		if (isSN) {
			if (isAdopted)
				return "Les sénateurs ont approuvé la proposition. Si leur version est identique à celle des députés, elle peut devenir loi ; sinon les débats reprennent.";
			if (isRejected)
				return "Les sénateurs ont rejeté la proposition. Les députés peuvent encore avoir le dernier mot.";
			return "Les sénateurs examinent la proposition en ce moment.";
		}
		if (isAN) {
			if (isAdopted)
				return "Les députés ont approuvé la proposition. Elle doit maintenant être examinée par les sénateurs.";
			if (isRejected)
				return "Les députés ont rejeté la proposition. Elle ne peut pas devenir loi en l'état.";
			return "Les députés examinent la proposition en ce moment.";
		}
		if (isInProgress) return "La proposition est en cours d'examen.";
	}

	// --- Dernière étape = renvoi en commission ou dépôt (pas encore de vote en plénière) ---

	if (lastVoteIdx >= 0 && s(lastVoteIdx).includes('adopté')) {
		const hasANAdopted = stepsName.some(
			(name, i) =>
				name.toLowerCase().includes('lecture') &&
				name.toLowerCase().includes('assemblée') &&
				s(i).includes('adopté')
		);
		const hasSNAdopted = stepsName.some(
			(name, i) =>
				name.toLowerCase().includes('lecture') &&
				name.toLowerCase().includes('sénat') &&
				s(i).includes('adopté')
		);

		if (hasANAdopted && hasSNAdopted) {
			return "Les deux assemblées ont approuvé la proposition. Elle est en cours de finalisation avant d'entrer en vigueur.";
		}
		if (hasANAdopted) {
			return "Les députés ont approuvé la proposition. Des sénateurs spécialisés l'étudient maintenant avant un vote au Sénat.";
		}
		if (hasSNAdopted) {
			return "Les sénateurs ont approuvé la proposition. Des députés spécialisés l'étudient maintenant avant un vote à l'Assemblée.";
		}
	}

	if (lastVoteIdx >= 0 && s(lastVoteIdx).includes('rejeté')) {
		if (n(lastVoteIdx).includes('sénat')) {
			return "Les sénateurs ont rejeté la proposition. Les députés peuvent encore avoir le dernier mot en la votant une dernière fois.";
		}
		// AN rejected but process continues (unusual) — describe current state neutrally
		return "La proposition a été rejetée par les députés. La procédure se poursuit.";
	}

	// Aucun vote — en commission ou tout juste déposée
	const depositedAtSenat = n(0).includes('sénat');
	if (depositedAtSenat) {
		return "La proposition est étudiée par des sénateurs spécialisés. Elle n'a pas encore été soumise au vote.";
	}
	return "La proposition est étudiée par des députés spécialisés. Elle n'a pas encore été soumise au vote.";
}
