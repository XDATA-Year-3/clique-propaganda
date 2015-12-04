import bson.json_util
from bson.objectid import ObjectId
import json
import sys


def main():
    node_table = {}

    while True:
        line = sys.stdin.readline()
        if not line:
            break

        record = json.loads(line)

        ident = str(record["twitter_id"])
        aoid = node_table.get(ident)
        if aoid is None:
            node_table[ident] = aoid = ObjectId()
            print bson.json_util.dumps({"_id": aoid,
                                        "type": "node",
                                        "data": {"twitter_id": ident,
                                                 "type": "audience",
                                                 "propaganda_urls_exposed_to": record["propaganda_urls_exposed_to"],
                                                 "geos": record["geos"],
                                                 "timestamps_of_propaganda": record["timestamps_of_propaganda"]}})

        for p in record["propagandists_followed"]:
            oid = node_table.get(p)
            if oid is None:
                node_table[ident] = oid = ObjectId()
                print bson.json_util.dumps({"_id": oid,
                                            "type": "node",
                                            "data": {"twitter_id": p,
                                                     "type": "propagandist"}})

            print bson.json_util.dumps({"_id": ObjectId(),
                                        "type": "link",
                                        "source": aoid,
                                        "target": oid,
                                        "data": {}})


if __name__ == "__main__":
    sys.exit(main())
