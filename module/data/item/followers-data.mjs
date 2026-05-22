const fields = foundry.data.fields;

export class FollowersData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      backgroundId:  new fields.StringField({ blank: true, initial: "" }),
      followerType:  new fields.StringField({ blank: true, initial: "" }),
      description:   new fields.HTMLField({ blank: true, initial: "" })
    };
  }
}
